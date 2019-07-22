/*
	Todo:

	- add_repository
	- remove_repository
	- edit
	- add_collaborator
	- remove_collaborator

	Public (Webhook) api
	 event handlers to update internal state
	- deployment
	- release
	- pull_request
	- pull_request_review
	- ...
*/



const http = require("http")
const https = require("https")
const url = require("url")

// Definitions of future CCF tables
var users = {}
var repositories = {}
var members = {}
var commits = {}

// GitHub Personal Access Token
var token = "072d3445cf3bc85d165e85b19f6a40fa55fccef2";


http.createServer(process_request).listen(8000)

/* Handles all incoming requests */
function process_request(req,res)
{
	var u = url.parse(req.url);
	res.writeHead(200, {"Content-Type": "application/json"})
	switch(u.pathname) {

		// Private (administrative) API
		case "/get_repo":
			get_repo(req, res);
			break;

		// Webhooks

		default:
			res.write("{error:1,msg:'unknown command'}")
			res.end()
	}
}




////////////////////////////////////////////////////////////////////////////////////////////
// Private (administrative) API Endpoints


/* Get Repository - Forwards request to GitHub */
function get_repo(req, res) {
	var cli = https.get("https://api.github.com/users/transparent-enclave/repos",
		{
			"headers": {
				"Authorization": "token "+ token,
				"User-Agent": "TESS",
			}
		},
		gres => get_repo_response(gres, res));
	cli.end();
}

/* Get Repository - Handles Response */
function get_repo_response(gres, res) {
	gres.setEncoding('utf8');
	var response = "";
	gres.on('data', (chunk) => {
		response += chunk;
	});
	gres.on('end', () => {
		var r = JSON.parse(response);
		console.log(r);
		res.write(response);
		res.end()
	});
}





////////////////////////////////////////////////////////////////////////////////////////////
// Webhook Endpoints