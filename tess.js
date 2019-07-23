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
		case "/webhooks/pull":
			webhooks_pull(req, res);
			break;

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

/* Called when new pull request is made */
function webhooks_pull (req, res) {
	
	var body = "";
	req.on('data', (chunk) => {
		body += chunk;
	});
	req.on('end', () => {
		var jsonBody = JSON.parse(body);
		var commitsEndpointUrl = jsonBody.pull_request._links.commits.href;

		//////// Need to check the nature of the webhook here
		// if the commit has 3 approvals from reviewers then 
		//     call build
		//     add hash of build as comment ??????
		// then do merge

		// commitsEndpointUrl is in the form:
		// https://api.github.com/repos/Codertocat/Hello-World/pulls/2/commits

		// send request to get the commits in this pull request
		var cli = https.get(commitsEndpointUrl,
			{
				"headers": {
					"Authorization": "token "+ token,
					"User-Agent": "TESS",
				}
			},
			function(gres) {
				gres.setEncoding('utf8');
				var response = "";
				gres.on('data', (chunk) => {
					response += chunk;
				});
				gres.on('end', () => {
					var commits = JSON.parse(response);
					// loop through the commits on this pull request
					for (var i = 0; i < commits.length; i++) {
						// check signature on each
						console.log(commits[i]);

						// VerifyCommitSignature(..., ...);

						// add to table of commits


					}
					res.write(response);
					res.end()
				});
			}
		);
	});
}

function MergePullRequest () {

	// send request to master

	return "Not Implemented";
}

function CallBuild () {

	// send request to begin docker build

	return "Not Implemented";
}



////////////////////////////////////////////////////////////////////////////////////////////
// Utilities


function VerifyCommitSignature (commit, signature) {

	// Needs completing with signature verification

	return true;
}