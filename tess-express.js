// Routing
const express = require('express')
var app = express()
const port = 8000

// Github Requests
var request = require("http");


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
const WEBHOOK_PULL = "/webhooks/pull";
const WEBHOOK_NEWREVIEW = "/webhooks/review";

// Github User
GITHUB_USER_TOKEN = "072d3445cf3bc85d165e85b19f6a40fa55fccef2";
GITHUB_USER_AGENT = "TESS";

app.post(EP_CREATE_REPO, function (req, res) {
	console.log("\n\n\n\n\n\n\n\n\n\n");
	console.log("Add repo request received. Repo name: " + req.query.name);

	// Post!
	request.post({
		url: "https://api.github.com" + EP_CREATE_REPO,
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
	res.send("OK");
})

app.patch(EP_EDIT_REPO, function (req, res) {
	console.log(req);
	console.log("Edit repo request received. Owner: " + req.params.owner + ", name: " + req.params.repo);
	res.send("OK");
})





////////////////////////////////////////////////////////////////////////////////////////////
// Webhook Endpoints

/* Called when new pull request is made */
app.post(WEBHOOK_PULL, function (req, res) {

	var jsonBody = JSON.parse(req.body);

	// filter out webhook calls which are not for opening the request
	if (jsonBody.action != "opened") {
		res.write("Not interested in this Event. Only accept Pull Request opened events.");
		res.end();
	}

	// Check the pull request is for 'release' branch
	if (jsonBody.base.ref != "release") {
		res.write("PR is not for the release branch. Ignoring this PR.");
		res.end();
	}

	// Check the pull request has some required reviewers
	if (jsonBody.pull_request.requested_reviewers.length == 0) {
		res.write("PR needs to have some required reviews. Ingoring this PR.");
		res.end();
	}

	var commitsEndpointUrl = jsonBody.pull_request._links.commits.href;
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

				var isVerified = commits[i][0].commit.verified;
				if (!isVerified) {
					// commit not signed
					res.write("Commit not signed! Ignoring this pull request.");
					res.end();
				}

				var signature = commits[i][0].commit.signature;

				// check the commit signature
				if (!VerifyCommitSignature(commits[i][0], signature) {
					res.write("Commit signature bad! Ignoring this pull request.");
					res.end();
				}

				// Send request to build
				CallBuild();

				// If build succeeds, need to add hash to PR as comment

			}
			res.write(response);
			res.end()
		});
	});
});

/* Called when new review is added to pull request */
app.post(WEBHOOK_NEWREVIEW, function (req, res) {

	// merge immediatley after all reviews done

});



function AddCommentToPR (repoOwner, repoName, pullNumber, reviewText) {

	var endpointURL = "https://api.github.com/repos/" + repoOwner + "/" + repoName + "/pulls/" + pullNumber + "/comments";




	return "Not Implemented";
}

function MergePullRequest (branchName) {

	// send request to merge branch into master

	// github have commit signing key so sign the merge commit

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
function VerifyCommitSignature (commit, signature) {

	// Needs completing with signature verification

	return true;
}





app.listen(port, () => console.log(`Listening on port ${port}!`));