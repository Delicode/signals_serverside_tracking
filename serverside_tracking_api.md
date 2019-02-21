# Serverside realtime tracking API

Using the Delicode Signals realtime tracking API is done over a websocket connection. To open a connection, you require a JSON Web Token (JWT) for your location. This can be found one the Signals setup page under "Locations".

### General

All messages sent to the server must be UTF-8 cleartext, encoded in JSON. Every message sent to the server must contain the "type" field:

```
{
	"type": "message_type_here",
	other_fields_here
}
```

Sending messages without these fields results in the socket being closed.

The server responses to all requests are always formatted as follows:

```
{
	"type": "some_message_type",
	"result": "success"
}
```

In case of an error with the request, the result field contains a string different than "success", describing the error encountered.

### Connecting

To register a new client for receiving realtime tracking data from the server, open a websocket connection to the endpoint at (port 443):

```
wss://signals.delicode.com/websocket_realtime
```

and send the following message before 5 seconds have passed:

```
{
	"type": "realtime_register",
	"token: "your_token_here",
	"locations": [array of location identifiers as integers]
}
```

A valid response from the server will be:

```
{
	"type": "realtime_register",
	"result": "success"
}
```

In case there's a problem authenticating the token, the socket connection will be closed by the remote.

After this message, the server will be sending data related to all the locations specified in the request.

The locations parameters must be a valid location ids for your current token.

Additional "realtime_register" messages from the same socket will be ignored after a registration has been finished once.

### Maintaining a connection

To keep a connection alive, you must periodically send a heartbeat message to the server. The message must be of a following format:

```
{
	"type": "realtime_heartbeat"
}
```

No additional parameters are required. A successful heartbeat message is not replied to. Recommended heartbeat interval is 20-25 seconds.

### Realtime data

As data is calculated from the devices assigned to a location, the server can send the following messages:

#### When a person's point data is updated, or a new person is detected

```
{
	"type": "realtime_person_position",
	"person_id": integer,
	"location_id": integer,
	"position": {
		"x": number,
		"y": number
	}
}
```

The position data is centimeters in relation to the origin point in the location. The origin is where the "ruler" is placed on the location.

#### When a person is lost

```
{
	"type": "realtime_person_lost",
	"person_id": integer,
	"location_id": integer
}
```

#### When demographics data is available

```
{
	"type": "realtime_demographics",
	"person_id": integer,
	"location_id": integer,
	"gender": integer,
	"age": integer
}
```

In this data, gender is:

* 1: The person is male
* 2: The person is female

And age is a single integer approximating the age.

The demographics data may appear even if no any position data has been transmitted for the person in question.

More than one demographics message may arrive for each person as the gender and age are being estimated over and over again.

The demographics data is not always calculated for a person. This can happen if the sensor doesn't have time to analyze the face, or if the face isn't visible to the sensor.

#### If the connection is closed for some reason by the remote server

```
{
	"type": "close_connection",
	"message": "message detailing the close reason"
}
```

