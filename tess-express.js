// Routing
const https = require("https")
const request = require("request");
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
const EP_MASTER_COMMIT = "/repos/:owner/:repo/git/refs/heads/master";
const WEBHOOK_PATH = "/webhooks";
const EP_COMMIT = "/repos/:owner/:repo/git/commits";
const EP_CREATE_BRANCH = "/repos/:owner/:repo/git/refs";
const WEBHOOK_PULL = "/webhooks/pull";
const WEBHOOK_NEWREVIEW = "/webhooks/review";

// Collaborator operations
const EP_ADD_COLLAB = "/repos/:owner/:repo/collaborators/:username";
const EP_REMOVE_COLLAB = "/repos/:owner/:repo/collaborators/:username";

// Github User
const GITHUB_USER_TOKEN = new Buffer("YTdjZjM0NmE1NjYxODAxNDk2Mjk5NDQyY2RlNDcxYTM0ZjUzMTgyNQ==","base64").toString("ascii");
const GITHUB_USER_AGENT = "TESS";
const GITHUB_USER = "transparent-enclave";
const GITHUB_WEBHOOK_SECRET = "7bef78260ea8801735186b374529fc297196fee1";

app.post(EP_CREATE_REPO, function (req, res) {
    console.log("\n\n\n\n\n\n\n\n\n\n");
	console.log("Add repo request received. Repo name: " + req.body.name);

	// Post!
	request.post({
		url: "https://api.github.com" + EP_CREATE_REPO,
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
        json: true,
        // autoinit should be true to create a commit to get a sha1 hash to be used for creating a branch later
		body: req.body,
	}, 
	// Handle Github response
	function(error, response, body){
		if (error) {
			console.log("Error occured:");
			console.log(error);
			res.send(body);
		} else {
            if (response.statusCode == 201) {
                console.log("Repo successfully created.");
                console.log("Github response:")
				console.log("full_name: " + body.full_name);
                request.get({
                    url: "https://api.github.com" + EP_MASTER_COMMIT.replace(":owner/:repo", body.full_name),
                    headers: {
                        "Authorization": "token "+ GITHUB_USER_TOKEN,
                        "User-Agent": GITHUB_USER_AGENT,
                        "content-type" : "application/json"
					},
					json: true,
				},
					function (err, resp, bdy) {
						if (err) {
							console.log("Error getting the master latest commit hash.");
						} else {
							console.log(JSON.stringify(resp) + JSON.stringify(bdy));
							console.log("Bdy: " + JSON.stringify(resp));							

							request.post({ 
								url: "https://api.github.com" + EP_CREATE_BRANCH.replace(":owner/:repo", body.full_name),
								headers: {
									"Authorization": "token "+ GITHUB_USER_TOKEN,
									"User-Agent": GITHUB_USER_AGENT,
									"content-type" : "application/json"
								},
								json: true,
								body: {
									"ref": "refs/heads/release",
									"sha": bdy.object.sha
								}
							},
				
								function(er, re, bd) {
									if (er) {
										console.log("Error creating release branch.");
									} else {
										console.log("Release branch successfully created.");
										console.log(JSON.stringify(re) + JSON.stringify(bd));
										res.send(JSON.stringify(re) + JSON.stringify(bd));			
									}
							});
						}
					}
                );
            } else {
                console.log("Couldn't create repo. Status code: " + response.statusCode);
                res.send(JSON.stringify(response) + JSON.stringify(body));
            }
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

/* Called when new pull request is made */
function new_pull_request(req, res)
{
	var jsonBody = JSON.parse(req.body);
	var issueCommentEndpointURL = jsonBody.pull_request.issue_url + "/comments";
	var commitsEndpointUrl = jsonBody.pull_request._links.commits.href;
	var issueEndpointURL = jsonBody.pull_request.issue_url;

	// filter out webhook calls which are not for opening the request
	if (jsonBody.action != "opened") {
		res.write("Not interested in this Event. Only accept Pull Request opened events.");
		res.end();
		return;
	}

	// Check the pull request is for 'release' branch
	if (jsonBody.pull_request.base.ref != "release") {
		res.write("PR is not for the release branch. Ignoring this PR.");
		res.end();
		return;
	}

	// Check the pull request has some required reviewers
	if (jsonBody.pull_request.requested_reviewers.length == 0) {
		res.write("PR needs to have some required reviews. Ingoring this PR.");
		AddCommentToPR(issueCommentEndpointURL, "This PR has been setup incorrectly so will be ignored. It needs to have at least 1 reviewer.");
		ClosePullRequest(issueEndpointURL);
		res.end();
		return;
	}

	// send request to get the commits in this pull request
	var cli = https(commitsEndpointUrl,
		{
			"headers": {
				"Authorization": "token " + GITHUB_USER_TOKEN,
				"User-Agent": GITHUB_USER_AGENT,
				"content-type": "application/json"
			}
		},
		(err, gres, body) => {
			var commits = JSON.parse(body);
			// loop through the commits on this pull request
			for (var i = 0; i < commits.length; i++) {
/*
				var isVerified = commits[i].commit.verified;
				if (!isVerified) {
					// commit not signed
					res.write("Commit not signed! Ignoring this pull request.");
					AddCommentToPR(issueCommentEndpointURL, "Ignoring this PR. All of the commits should have been signed");
					ClosePullRequest(issueEndpointURL);
					res.end();
					return;
				}
*/
				var signature = commits[i].commit.signature;

				// check the commit signature
				if (!VerifyCommitSignature(commits[i], signature)) {
					res.write("Commit signature bad! Ignoring this pull request.");
					AddCommentToPR(issueCommentEndpointURL, "Ignoring this PR. One of the commit signatures is not valid.");
					ClosePullRequest(issueEndpointURL);
					res.end();
					return;
				}

				// Send request to build
				RunBuild(jsonBody.pull_request);
				res.write("A build has been queued");
				res.end();
			}
			res.write(response);
			res.end()
	});
}

/* Called when a new review is added */
function new_review_request(req, res) {

	var jsonBody = JSON.parse(req.body);

	var requiredReviewers = jsonBody.pull_request.requested_reviewers;
	var reviewer = jsonBody.review.user.login;
	var reviewCommitId = jsonBody.review.commit_id;
	var pullRequestLatestCommitId = jsonBody.pull_request.head.sha;

	// don't check the 'action' because we want to consider all three: 'submitted', 'edited', 'dismissed'

	// Check the pull request is for 'release' branch
	if (jsonBody.pull_request.base.ref != "release") {
		res.write("PR is not for the release branch. Ignoring this PR.");
		res.end();
		return;
	}

	// Check the pull request has some required reviewers
	if (jsonBody.pull_request.requested_reviewers.length == 0) {
		res.write("PR needs to have some required reviews. Ingoring this PR.");
		AddCommentToPR(issueCommentEndpointURL, "This PR has been setup incorrectly so will be ignored. It needs to have at least 1 reviewer.");
		ClosePullRequest(issueEndpointURL);
		res.end();
		return;
	}

	// check the review state
	if (jsonBody.review.state != "APPROVED") {
		res.write("PR has not been approved with this review so wait for more commits.");
		res.end();
		return;
	}

	// check this reviewer is required
	if (!requiredReviewers.includes(reviewer)) {
		res.write("This person's review is not required, so it doesn't change anything.");
		res.end();
		return;
	}

	// Check review is for latest commit
	if (reviewCommitId != pullRequestLatestCommitId) {
		res.write("Review does not cover the latest commit(s). Ignoring review.");
		res.end();
		return;
	}

	// Get all reviews
	var allReviewsURL = jsonBody.review.pull_request_url + "/reviews";
	// e.g. https://api.github.com/repos/Codertocat/Hello-World/pulls/2/reviews

	https({
		url: allReviewsURL,
		method: "GET",
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
	},
	// Handle Github response
	(err, gres, body) => {
		if (error) {
			console.log("Something went wrong getting the reviews.");
			res.write("Something went wrong getting the reviews.");
			res.end();
			return;
		}
		var reviewArr = JSON.parse(body);

		// initialize array to record whether we've found all the reviews we need
		var reviewsFound = [];
		for (var i = 0; i < requiredReviewers.length; i++) { // << probably a nicer way of doing this
			reviewsFound.push(false); 
		}

		// look through all the reviews
		for (var i = 0; i < reviewArr.length; i++) {

			// check the review state
			if (reviewArr[i].state != "APPROVED") {
				continue;
			}
			// Check review is for latest commit
			if (reviewArr[i].commit_id != pullRequestLatestCommitId) {
				continue;
			}
			// check the reviewer
			if (!requiredReviewers.includes(reviewArr[i].user.login)) {
				reviewsFound[requiredReviewers.indexOf(reviewArr[i].user.login)] = true;
			}
		}

		// check we have reviews from all the required reviewers
		for (var i = 0; i < reviewsFound.length; i++) {
			if (!reviewsFound[i]) {
				console.log("Don't have all required reviews to merge.");
				res.write("Don't have all required reviews to merge.");
				res.end();
				return;
			}
		}

		// Send request to build
		CallBuild();

		// If build succeeds, need to add hash to PR as comment
		AddCommentToPR(issueCommentEndpointURL, "Build Hash: xxx");

		// Then merge
		var mergeURL = jsonBody.pull_request.issue_url + "/lock";
		var branchName = jsonBody.pull_request.head.ref;
		MergePullRequest(mergeURL, branchName);
	});

}

/* Called when commits are pushed */
function new_push_request(req, res) {

	/*
		1. check commits are being added to a PR
		2. check the pr is for 'release' branch
		3. check the pr has some reviewers
		4. check the new commits are valid (check signatures)
			5. Add 'bad' comment if the one of the new commits is not valid
	*/

}

app.post(WEBHOOK_PATH, function (req, res) {
  if(!checkMAC(req)) {
		res.write("Invalid Webhook MAC.");
		res.end();
		return;
	}
  switch(req.headers["x-github-event"]){
		case "pull_request":
		  new_pull_request(req, res);
			break;
		case "pull_request_review":
		  new_review_request(req, res);
		    break;
		case "push":
		  new_push_request(req, res);
		    break;
		default:
		  console.log("Ignoring event of type "+req.headers["x-github-event"])
		  res.write("Unknown event type.")
			res.end()
	}
});

/* Sends request to GitHub API to add a comment to the pull request */
function AddCommentToPR (endpointURL, commentText) {
	https({
		url: endpointURL,
		method: "POST",
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
		json: true,
		body: {
			"body": commentText,
		},
	},
	// Handle Github response
	function(error, response, body){
		if (error) {
			console.log("Something went wrong adding a comment.");
		}
	});
}

/* Call to close a pull request */
function ClosePullRequest (issueEndpointURL) {

	// input should be:    jsonBody.pull_request.issue_url + "/lock";
	// e.g. https://api.github.com/repos/Codertocat/Hello-World/issues/2

	https({
		method: "PATCH",
		url: issueEndpointURL,
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
		json: true,
		body: {
			"state": "closed"
		},
	},
	// Handle Github response
	function(error, response, body){
		if (error) {
			console.log("Something went wrong closing PR.");
		}
	});
}

/* Call to merge a pull request into release */
function MergePullRequest (mergeEndpointURL, branchName) {

	// input should be:    jsonBody.pull_request.issue_url + "/lock";
	// e.g. https://api.github.com/repos/Codertocat/Hello-World/merges

	// send request to merge branch into release
	// github has commit signing key so signs the merge commit
	request.put({
		url: mergeEndpointURL,
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
		json: true,
		body: {
			"base": "release",
			"head": branchName,
			"commit_message": "Merging '" + branchName + "'' into 'release'"
		},
	},
	// Handle Github response
	function(error, response, body){
		if (response.statusCode != 200) {
			console.log("Something went wrong when merging.");
		}
	});

}

function RunBuild (info) {
  console.dir(info);
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
