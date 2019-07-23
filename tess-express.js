// Routing
const https = require("https")
const request = require("http");
const express = require('express')
const crypto = require('crypto');
const exec = require('child_process').exec;
const bodyParser = require('body-parser')

var app = express()

// For webhooks we need the raw body to compute the MAC
app.use("/webhooks", bodyParser.text({type: '*/*'}));
app.use(express.json())
app.use(express.urlencoded({extended:true}))

const port = 8000

// Definitions of future CCF tables
var users = {}
var repositories = {}
var members = {}
var commits = {}

// Endpoints
const GITHUB_API_URL = "https://api.github.com";
const EP_CREATE_REPO = "/user/repos";
const EP_DELETE_REPO = "/repos/:owner/:repo";
const EP_EDIT_REPO = "/repos/:owner/:repo";
const WEBHOOK_PATH = "/webhooks";

// Github User
const GITHUB_USER_TOKEN = "072d3445cf3bc85d165e85b19f6a40fa55fccef2";
const GITHUB_USER_AGENT = "TESS";
const GITHUB_USER = "transparent-enclave";
const GITHUB_WEBHOOK_SECRET = "7bef78260ea8801735186b374529fc297196fee1";

app.post(EP_CREATE_REPO, function (req, res) {
	console.log("\n\n\n\n\n\n\n\n\n\n");
	console.log("Add repo request received. Repo name: " + req.query.name);

	// Post!
	request.post({
		url: GITHUB_API_URL + EP_CREATE_REPO,
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
		json: true,
		body: {
			name: req.query.name
		},
	},
	// Handle Github response
	function(error, response, body){
		if (error) {
			console.log("Error occured:");
			console.log(error);
			res.send(body);
		} else {
			console.log("Github response body:")
			console.log(body);
			res.send(body);
		}
	});
})

app.delete(EP_DELETE_REPO, function (req, res) {
    console.log(req);
    console.log("Delete repo request received. Owner: " + req.params.owner + ", name: " + req.params.repo);
    request.delete({
        url: GITHUB_API_URL + EP_DELETE_REPO.replace(":owner", req.params.owner).replace(":repo", req.params.repo),
        headers: {
            "Authorization": "token " + GITHUB_USER_TOKEN,
            "User-Agent": GITHUB_USER_AGENT,
            "content-type": "application/json"
        },
    },

    // Handle Github response
    function (error, response, body) {
        if (error) {
            console.log("Error occured:");
            console.log(error);
            res.send(body);
        } else {
            console.log("Status code: " + response.statusCode);
            if (response.statusCode == 204) {
                console.log("Successfully deleted.");
                res.send(body);
            }
            console.log("Github response body:")
            console.log(body);
        }
    });
})

app.patch(EP_EDIT_REPO, function (req, res) {
    console.log(req);
    console.log("Edit repo request received. Owner: " + req.params.owner + ", name: " + req.params.repo);
    console.log("Body: ");
    console.log(req.body);
    request.patch({
        url: GITHUB_API_URL + EP_EDIT_REPO.replace(":owner", req.params.owner).replace(":repo", req.params.repo),
        headers: {
            "Authorization": "token " + GITHUB_USER_TOKEN,
            "User-Agent": GITHUB_USER_AGENT,
            "content-type": "application/json"
        },
        body: JSON.stringify(req.body),
    },
        // Handle Github response
        function (error, response, body) {
            if (error) {
                console.log("Error occured:");
                console.log(error);
                res.send(body);
            } else {
                console.log("Status code: " + response.statusCode);
                if (response.statusCode == 200) {
                    console.log("Successfully updated.");
                    res.send(body);
                }
                console.log("Github response body:")
                console.log(body);
            }
        });
})





////////////////////////////////////////////////////////////////////////////////////////////
// Webhook Endpoints

function new_pull_request(req, res)
{
	var jsonBody = JSON.parse(req.body);
	var issueCommentEndpointURL = jsonBody.pull_request.issue_url + "/comments";
	var commitsEndpointUrl = jsonBody.pull_request._links.commits.href;
	var lockIssueEndpointURL = jsonBody.pull_request.issue_url + "/lock";
	// commitsEndpointUrl is in the form:
	// https://api.github.com/repos/Codertocat/Hello-World/pulls/2/commits

	// filter out webhook calls which are not for opening the request
	if (jsonBody.action != "opened") {
		res.write("Not interested in this Event. Only accept Pull Request opened events.");
		res.end();
	}

	// Check the pull request is for 'release' branch
	if (jsonBody.pull_request.head.ref != "release") {
		res.write("PR is not for the release branch. Ignoring this PR.");
		res.end();
	}

	// Check the pull request has some required reviewers
	if (jsonBody.pull_request.requested_reviewers.length == 0) {
		res.write("PR needs to have some required reviews. Ingoring this PR.");
		AddCommentToPR(issueCommentEndpointURL, "This PR has been setup incorrectly so will be ignored. It needs to have at least 1 reviewer.");
		ClosePullRequest(lockIssueEndpointURL);
		res.end();
	}

	// send request to get the commits in this pull request
	var cli = https.get(commitsEndpointUrl,
		{
			"headers": {
				"Authorization": "token " + GITHUB_USER_TOKEN,
				"User-Agent": GITHUB_USER_AGENT,
				"content-type": "application/json"
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

				var isVerified = commits[i][0].commit.verified;
				if (!isVerified) {
					// commit not signed
					res.write("Commit not signed! Ignoring this pull request.");
					AddCommentToPR(issueCommentEndpointURL, "Ignoring this PR. All of the commits should have been signed");
					ClosePullRequest(lockIssueEndpointURL);
					res.end();
				}

				var signature = commits[i][0].commit.signature;

				// check the commit signature
				if (!VerifyCommitSignature(commits[i][0], signature)) {
					res.write("Commit signature bad! Ignoring this pull request.");
					AddCommentToPR(issueCommentEndpointURL, "Ignoring this PR. One of the commit signatures is not valid.");
					ClosePullRequest(lockIssueEndpointURL);
					res.end();
				}

				// Send request to build
				CallBuild();

				// If build succeeds, need to add hash to PR as comment
				// AddCommentToPR(issueCommentEndpointURL, "Build Hash: " + ... );
			}
			res.write(response);
			res.end()
		});
	});
}

/* Called when new pull request is made */
app.post(WEBHOOK_PATH, function (req, res) {
  if(!checkMAC(req)){
		res.write("Invalid Webhook MAC.");
		res.end();
		return;
	}
  switch(req.headers["x-github-event"]){
		case "pull_request":
		  new_pull_request(req, res);
			break;
		default:
		  console.log("Ignoring event of type "+req.headers["x-github-event"])
		  res.write("Unknown event type.")
			res.end()
	}
});

/* Sends request to GitHub API to add a comment to the pull request */
function AddCommentToPR (endpointURL, commentText) {
	request.post({
		url: endpointURL,
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
		json: true,
		body: {
			"body": reviewText,
		},
	},
	// Handle Github response
	function(error, response, body){
		if (response.statusCode != 200) {
			console.log("Something went wrong adding a comment.");
		}
	});
}

/* Call to close a pull request */
function ClosePullRequest (lockIssueEndpointURL) {

	// input should be:    jsonBody.pull_request.issue_url + "/lock";
	// e.g. https://api.github.com/repos/Codertocat/Hello-World/issues/2

	request.put({
		url: lockIssueEndpointURL,
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
		json: true,
		body: {
			"locked": true,
  			"active_lock_reason": "resolved"
		},
	},
	// Handle Github response
	function(error, response, body){
		if (response.statusCode != 200) {
			console.log("Something went wrong adding a comment.");
		}
	});
}

function MergePullRequest (branchName) {

	// send request to merge branch into release
	// github has commit signing key so signs the merge commit

	// POST /repos/:owner/:repo/merges
	// https://developer.github.com/v3/repos/merging/

	return "Not Implemented";
}

function CallBuild () {

	// send request to begin docker build
	// async

	return "Not Implemented";
}

////////////////////////////////////////////////////////////////////////////////////////////
// Utilities

/*
	commit - The commit in format returned by GitHub
	signature - string - the commit signature
 */
function VerifyCommitSignature (commit, sig) {
	console.log(commit)
	console.log(sig)
	return true
}

function checkMAC(req) {
	var sig = "sha1=" + crypto.createHmac('sha1', GITHUB_WEBHOOK_SECRET).update(req.body).digest('hex');
	if (req.headers['x-hub-signature'] != sig)
	{
		console.log("Rejected webhook due to x-hub-signature "+req.headers["x-hub-signature"]+" not matching "+sig)
		return false;
	}
	return true;
}

app.listen({host:"0.0.0.0",port:port}, () => console.log(`Listening on port ${port}!`));
