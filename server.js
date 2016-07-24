var unirest = require('unirest');
var express = require('express');
var events = require('events');

/* the getFromApi function takes two arguments: an endpoint name, and an object
containing arguments to provide in the query string of the endpoint */
var getFromApi = function(endpoint, args) {
    /* EventEmitter is created, which is used to communicate that getting the
    information was either sucessful or failed */
    var emitter = new events.EventEmitter();
    /* use unirest to make a GET request, adding the args as a query string using
    the qs method */
    unirest.get('https://api.spotify.com/v1/' + endpoint)
        .qs(args)
        /* the end method is called from the HTTP response to tell you that
        all the data has been recieved, you trigger your own end event on
        the emitter, attaching the response body which has been parsed by
         unirest */
        .end(function(response) {
            if (response.ok) {
                emitter.emit('end', response.body);
            }
            /* in the case of an error, your own error event is triggered on
            the emitter, attaching the error code returned by unirest */
            else {
                emitter.emit('error', response.code, response.body);
            }
        });
    return emitter;
};

var app = express();
app.use(express.static('public'));
/* when a user makes a request to /search/:name you are going to make a request
to the Spotify /search endpoint to find information on the artist which they
are looking for */
/* when a request to /search/:name is made you call the getFromApi function,
telling it to use the endpoint /search?q=<name>&limit=1&type=artist */
app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist',
    });
    /* you then add lsiteners to the EventEmitter returned from getFromApi for end
    and error events */
    /* when the end event is emitted, the function is called, which then extracts
    the artist from the object and returns it in a response */
    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];
        var artistId = item.artists.items[0].id;

        var requestRelated = getFromApi('artists/' + artistId + '/related-artists', {
            id: req.params.id
        });
        requestRelated.on('end', function(item) {
            artist.related = item.artists;
            res.json(artist);
            var relatedId = artist.related[0].id;
            var requestTop = getFromApi('artists/' + relatedId + '/top-tracks', {
                id: req.params.id,
                country: 'US'
            });
            requestTop.on('end', function(item) {
                for(i = 0; i < 5; i++) {
                    console.log(item.tracks[i].name);
                }
            });
        });
        requestRelated.on('error', function(code, body) {
            console.log(code, body);
        });
    });
    /* if there is an error, the error event handler's callback function sends
    that status coade to the browser */
    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});
app.listen(8080);
