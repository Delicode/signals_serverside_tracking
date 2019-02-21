'use-strict';

/**
 * An example for utilizing the Delicode Signals serverside realtime tracking
 * endpoint and visualizing its data on an example location
 */

var WebSocket = WebSocket || MozWebSocket;
var remote_url = "wss://signals.delicode.com/websocket_realtime";

// Resolution for the displayed image on which points are drawn
var width = 500;
var height = 500;

// Maximum and minimum values for the arriving data from the server
// Customize this based on how large your location is
// This is in centimeters
var val_min = -4500;
var val_max = 4500;

// Containers for data received from the remote
var person_point_data = [];
var demographics = [];
var text_to_draw = [];
var personCount = 0;
var demoCount = 0;
var textCount = 0;

// scalers which map the input data from -45 to 45 meter range to the 500x500 image coordinates
var x_scale = d3.scaleLinear().domain([val_min, val_max]).range([0, width]);
var y_scale = d3.scaleLinear().domain([val_min, val_max]).range([0, height]);

var svg = undefined;

var colors = [
	"red",
	"cyan",
	"orange",
	"purple",
	"green",
	"yellow"
];

function create_svg() {

	// Create the base svg instance on which everythign else is drawn
	svg = d3.select("#floorplan").append("svg")
		.attr("width", width)
		.attr("height", height);

	// Draw a grid of 5x5 meter squares
	var grid_g = svg.append("g").style("opacity", 0.5);
	grid_g.attr("id", "grid");

	var total_range = val_max - val_min;
	var line_spacing_cm = 500;
	var lines = total_range / line_spacing_cm;

	for (var j = val_min; j < val_max; j += line_spacing_cm) {
		grid_g.append("line")
			.attr("x1", x_scale(val_min))
			.attr("x2", x_scale(val_max))
			.attr("y1", y_scale(j))
			.attr("y2", y_scale(j))
			.style("stroke", "black")
			.style("stroke-width", "1.1");

		grid_g.append("line")
			.attr("x1", x_scale(j))
			.attr("x2", x_scale(j))
			.attr("y1", y_scale(val_min))
			.attr("y2", y_scale(val_max))
			.style("stroke", "black")
			.style("stroke-width", "1.1");
	}
}

function remove_point(id) {
	var remove_id = -1;

	for (var p = 0; p < person_point_data.length; p++) {
		if (person_point_data[p].id == id) {
			remove_id = p;
			break;
		}
	}

	person_point_data.splice(remove_id, 1);
}

function remove_demo(id) {
	var remove_id = -1;

	for (var p = 0; p < demographics.length; p++) {
		if (demographics[p].id == id) {
			remove_id = p;
			break;
		}
	}

	demographics.splice(remove_id, 1);
}

function remove_text(id) {
	var cur_time = Date.now();

	text_to_draw.forEach(function(d) {
		if (d.alive + 10000 < cur_time) {
			d.txt.remove();
		}
	});

	text_to_draw = text_to_draw.filter(function(d) {
		return d.alive + 5000 > cur_time;
	});
}

function draw_data() {

	demographics.forEach(function(d) {

		var per = undefined;

		// try to match this demographic data to some existing point,
		// looking for the point with matching person id and latest time
		for (var p = 0; p < person_point_data.length; p++) {
			var pt = person_point_data[p];
			if (pt.person_id == d.person_id) {
				if (per != undefined) {
					if (pt.created_time > per.created_time) {
						per = pt;
					}
				} else {
					per = pt;
				}
			}
		}

		if (per == undefined) {
			return;
		}

		// create a drawable text for this demographic, drawn on the person
		var text = undefined;
		for (var t = 0; t < text_to_draw.length; t++) {
			var  te = text_to_draw[t];
			if (te.person_id == per.person_id) {
				text = te;
				break;
			}
		}

		if (text == undefined) {
			textCount++;

			text = {
				textID: textCount,
				x: per.x,
				y: per.y,
				person_id: per.person_id,
				txt: svg.append("text"),

				// Store the time when this text was last updated
				alive: Date.now()
			}

			text_to_draw.push(text);
		}

		text.txt.attr("x", per.x);
		text.txt.attr("y", per.x);

		text.alive = Date.now();

		var label = d.gender == 1 ? "male, " : "female, ";
		label += d.age;
		text.txt.text(label);
	});

	// draw a circle at the position of every current detected person
	var pts = svg.selectAll(".person").data(person_point_data);
	pts.enter().append("circle").attr("class", "person");

	pts.attr("cx", function(d) { return d.x; })
		.attr("cy", function(d) { return d.y; })
		.attr("r", 5)
		.style("fill", function(d) { return d.color });

	pts.exit().remove();
}

$(document).ready(function() {

	create_svg();

	var token = "your_token_here";
	var ws = new WebSocket(remote_url);
	var hb_interval = undefined;
	var text_clean_interval = undefined;

	/**
	 * Periodically tell the server the connection is still in use
	 */
	function send_hb() {
		var out = {
			type: "realtime_heartbeat"
		};

		ws.send(JSON.stringify(out));
	}

	ws.onopen = function(evt) {
		console.log("Opened websocket connection");

		/**
		 * Send a login request immediately with a valid token
		 * The locations array must contain the ids for each location you wish to get
		 * data for. The ids can be found in the location editor on the setup page
		 */
		var out = {
			type: "realtime_register",
			token: token,
			locations: [21]
		};

		ws.send(JSON.stringify(out));
		hb_interval = setInterval(send_hb, 25000);
		text_clean_interval = setInterval(remove_text, 5000);
	};

	ws.onmessage = function(evt) {
		var msg = evt.data;
		var js = undefined;

		try {
			js = JSON.parse(msg);
		} catch (e) {
			console.error("Failed parsing incoming websocket message " +
				"as JSON: ", e);
			return;
		}

		switch (js.message_type) {
		case "realtime_person_position":

			personCount++;

			var pt = {
				id: personCount,
				color: colors[js.person_id % colors.length],
				x: js.position.x,
				y: js.position.y,
				person_id: js.person_id,
				create_time: Date.now(),
				expire: setTimeout(remove_point, 10000, personCount)
			};

			// scale the points so they map on the grid
			pt.x = x_scale(pt.x);
			pt.y = y_scale(pt.y);

			// remove all old points for this person
			person_point_data = person_point_data.filter(function(d) {
				return d.person_id != js.person_id;
			});

			person_point_data.push(pt);
			break;
		case "realtime_demographics":
			demoCount++;

			var demo = {
				id: demoCount,
				person_id: js.person_id,
				gender: js.gender,
				age: js.age,
				expire: setTimeout(remove_demo, 10000, demoCount)
			};

			// remove all old demographics for this person
			demographisc = demographics.filter(function(d) {
				return d.person_id != js.person_id;
			});

			demographics.push(demo);
			break;
		default:
			console.log("other message: ", js);
		}
	}

	ws.onclose = function(evt) {
		console.log("websocket closed: ", evt);
	}

	ws.onerror = function(evt) {
		console.log("websocket error: ", evt);
	}

	setInterval(draw_data, 33);
});


