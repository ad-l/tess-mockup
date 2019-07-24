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
var builds = {}
var releases = {}

// Endpoints
const GITHUB_API_URL = "https://api.github.com";
const EP_CREATE_REPO = "/user/repos";
const EP_DELETE_REPO = "/repos/:owner/:repo";
const EP_EDIT_REPO = "/repos/:owner/:repo";
const EP_MASTER_COMMIT = "/repos/:owner/:repo/git/refs/heads/master";
const EP_REGISTER_WEBHOOKS = "/repos/:owner/:repo/hooks";
const EP_PROTECT_RELEASE_BRANCH = "/repos/:owner/:repo/branches/release/protection";
const WEBHOOK_PATH = "/webhooks";
const EP_COMMIT = "/repos/:owner/:repo/git/commits";
const EP_CREATE_BRANCH = "/repos/:owner/:repo/git/refs";
const WEBHOOK_ADDRESS = "http://tess.westeurope.cloudapp.azure.com/webhooks";

// Collaborator operations
const EP_ADD_COLLAB = "/repos/:owner/:repo/collaborators/:username";
const EP_REMOVE_COLLAB = "/repos/:owner/:repo/collaborators/:username";

// Github User
const GITHUB_USER_TOKEN = new Buffer("NmU3YjI4YWUwZjA5ZmM5ZmEzMWE4NzE3YWNlMDdjYzczMWYyYTc0MQ==","base64").toString("ascii");
const GITHUB_USER_AGENT = "TESS";
const GITHUB_USER = "transparent-enclave";
const GITHUB_WEBHOOK_SECRET = "7bef78260ea8801735186b374529fc297196fee1";

// Patch for old nodejs versions
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function (searchElement, fromIndex) {
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }
      var o = Object(this);
      var len = o.length >>> 0;
      if (len === 0) {
        return false;
      }
      var n = fromIndex | 0;
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      function sameValueZero(x, y) {
        return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
      }
      while (k < len) {
        if (sameValueZero(o[k], searchElement)) {
          return true;
        }
        k++;
      }
      return false;
    }
  });
}

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

				// Store Github response
				repositories[body.full_name] = body;
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

										// Protect release branch

										request.put({
											url: "https://api.github.com" + EP_PROTECT_RELEASE_BRANCH.replace(":owner/:repo", body.full_name),
											headers: {
												"Authorization": "token "+ GITHUB_USER_TOKEN,
												"User-Agent": GITHUB_USER_AGENT,
												"content-type" : "application/json"
											},
											json: true,
											body: {
												required_status_checks: null,
												enforce_admins: null,
												required_pull_request_reviews: null,
												restrictions: {users: [body.owner.login], teams: []}
											}
										}, function (e, r, b) {
											if (e) {
												console.log("Error protecting branch.");
											} else {
												// For now it gives "Only organization repositories can have users and team restrictions"
												console.log("Protect branch response: " + JSON.stringify(r) + JSON.stringify(b));


												// Now register web hooks.
												request.post({
													url: "https://api.github.com" + EP_REGISTER_WEBHOOKS.replace(":owner/:repo", body.full_name),
													headers: {
														"Authorization": "token "+ GITHUB_USER_TOKEN,
														"User-Agent": GITHUB_USER_AGENT,
														"content-type" : "application/json"
													},
													json: true,
													body: {
														"name": "web",
														"active": true,
														"events": [
														  "push",
														  "pull_request_review",
														  "pull_request"
														],
														"config": {
														  "url": WEBHOOK_ADDRESS,
														  "content_type": "json",
														  "insecure_ssl": "0"
														}
													}
												}, function (e, r, b) {
													if (e) {
														console.log("Error occured while setting webhook.")
														console.log(e);
														console.log(r);
														console.log(b);
													} else {
														if (r.statusCode == 201) {
															console.log("Webhooks are successfully registered. Webhook addres is " + WEBHOOK_ADDRESS);
														} else {
															console.log("Problem registering webhook.")
															console.log(e);
															console.log(r);
															console.log(b);
														}
													}
												});
											}
										});
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

app.put(EP_ADD_COLLAB, function (req, res) {
    console.log(req);
    console.log("Add collaborator request received. Owner: " + req.params.owner + ", repo: " + req.params.repo +
                ", username: " + req.params.username);
    console.log("Body: ");
    console.log(req.body);
    request.put({
        url: "https://api.github.com" + EP_ADD_COLLAB.replace(":owner", req.params.owner).replace(":repo", req.params.repo)
                                                    .replace(":username", req.params.username),
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
                if (response.statusCode == 201) {
                    console.log("Successfully added collaborator.");
                    res.send(body);
                } else if (response.statusCode == 204) {
                    console.log("Already a collaborator.");
                    res.send(body);
                }
                console.log("Github response body:")
                console.log(body);
            }
        });
})

app.delete(EP_REMOVE_COLLAB, function (req, res) {
    console.log(req);
    console.log("Remove collaborator request received. Owner: " + req.params.owner + ", repo: " + req.params.repo +
                ", username: " + req.params.username);
    console.log("Body: ");
    console.log(req.body);
    request.delete({
        url: "https://api.github.com" + EP_REMOVE_COLLAB.replace(":owner", req.params.owner).replace(":repo", req.params.repo)
                                                    .replace(":username", req.params.username),
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
                    console.log("Collaborator deleted.");
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
  var statusURL = jsonBody.pull_request.statuses_url;

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
	var cli = request.get(commitsEndpointUrl,
		{
			"headers": {
				"Authorization": "token " + GITHUB_USER_TOKEN,
				"User-Agent": GITHUB_USER_AGENT,
				"content-type": "application/json"
			}
		},
		(err, gres, body) => {
			var pullReqCommits = JSON.parse(body);
			// loop through the commits on this pull request
			for (var i = 0; i < pullReqCommits.length; i++) {
				var signature = pullReqCommits[i].commit.signature;
				// check the commit signature
				if (!VerifyCommitSignature(pullReqCommits[i])) {
					res.write("Commit signature bad! Ignoring this pull request.");
					AddCommentToPR(issueCommentEndpointURL, "Ignoring this PR. Commit "+pullReqCommits[i].sha+" is not signed or has an invalid signature.");
					ClosePullRequest(issueEndpointURL);
					res.end();
					return;
				}
			}
      // Comment on PR
      console.log("Adding comment about TESS");
      AddCommentToPR(issueCommentEndpointURL, "This branch is protected by TESS. We have checked that all commit signatures are valid. Reviewer approval is required to merge this PR.");

      // Set build status to pending
      console.log("Set build status");
      SetBuildStatus(statusURL, "pending");
	});

  res.write("PR recorded on TESS");
  res.end();
}

/* Called when a new review is added */
function new_review_request(req, res) {

	var jsonBody = JSON.parse(req.body);
	var reviewer = jsonBody.review.user.login;
  var missing = jsonBody.pull_request.requested_reviewers.map(x => x.login);
	var reviewCommitId = jsonBody.review.commit_id;
	var pullRequestLatestCommitId = jsonBody.pull_request.head.sha;
	var commitsEndpointUrl = jsonBody.pull_request._links.commits.href;
  var issueCommentEndpointURL = jsonBody.pull_request.issue_url + "/comments";

	// don't check the 'action' because we want to consider all three: 'submitted', 'edited', 'dismissed'

	// Check the pull request is for 'release' branch
	if (jsonBody.pull_request.base.ref != "release") {
		res.write("PR is not for the release branch. Ignoring this PR.");
		res.end();
		return;
	}

	// Get all reviews
  console.log("Checking other reviews.");
	request.get({
		url: jsonBody.review.pull_request_url + "/reviews",
		headers: {
			"Authorization": "token "+ GITHUB_USER_TOKEN,
			"User-Agent": GITHUB_USER_AGENT,
			"content-type" : "application/json"
		},
	},
	// Handle Github response
	(err, gres, body) => {
		if (err) {
			console.log("Something went wrong getting the reviews.");
			res.write("Something went wrong getting the reviews.");
			res.end();
			return;
		}

		var reviewArr = JSON.parse(body);
    console.log("Missing: "+missing.length+", submitted: "+reviewArr.length);
    var approved = (missing.length == 0 && reviewArr.length > 0);

		// look through all the reviews
		for (var i = 0; i < reviewArr.length; i++) {
      console.log("Review "+i+": "+reviewArr[i].state+" "+(reviewArr[i].commit_id == pullRequestLatestCommitId ? "up to date" : "outdated"));
      approved = (approved
         && reviewArr[i].state == "APPROVED"
         && reviewArr[i].commit_id == pullRequestLatestCommitId);
		}

		if (!approved) {
			console.log("Approval conditions not met.");
			return;
		}

    console.log("PR is approved, checking if PR can be merged...")
    request.get({url: jsonBody.pull_request.url,
  		headers: {
  			"Authorization": "token "+ GITHUB_USER_TOKEN,
  			"User-Agent": GITHUB_USER_AGENT,
  			"content-type" : "application/json"
  		}},

  	(err, gres, body) => {
      if(err){
        console.log("Error checking PR status");
        console.log(err);
        return;
      }
      console.dir(body);
      /*
      // If build succeeds, need to add hash to PR as comment
      AddCommentToPR(issueCommentEndpointURL, "Build Hash: xxx");
      // Then merge
      var mergeURL = jsonBody.pull_request.issue_url + "/lock";
      var branchName = jsonBody.pull_request.head.ref;
      MergePullRequest(mergeURL, branchName);

      var timeStamp = Math.floor(Date.now() / 1000);
      releases.append({
        "repository": jsonBody.repo.full_name,
        "pull_request_number": jsonBody.pull_request.number,
        "timestamp": timeStamp,
      });

      // add new commits to commits table
      for (var i = 0; i < pullReqCommits.length; i++) {
        commits.append(pullReqCommits[i]);
      }
      // Send request to build
      RunBuild(jsonBody.pull_request);
      */
    });
	});
  res.write("New review processed.");
  res.end();
}

/* Called when a push is made */
function new_push(req, res) {
	var jsonBody = JSON.parse(req.body);
	var ref = jsonBody.ref;

	if (ref.substring(0, 10) != "ref/heads/") {
		res.write("This isn't a push to a branch.");
		res.end();
		return;
	}

	var branchName = ref.substring(10, ref.length);
	var repoName = jsonBody.repository.full_name;
	var pullRequestUrl = "https://api.github.com/repos/" + repoName + "/pulls";
	// e.g. https://api.github.com/repos/microsoft/vscode/pulls

	if (jsonBody.commits.length == 0) {
		res.write("No commits in this push.");
		res.end();
		return;
	}

	// get pull requests to check one exists for this branch
	var cli = request.get(pullRequestUrl,
		{
			"headers": {
				"Authorization": "token " + GITHUB_USER_TOKEN,
				"User-Agent": GITHUB_USER_AGENT,
				"content-type": "application/json"
			}
		},
		(err, gres, body) => {
			var pullRequests = JSON.parse(body);
			var foundPRForBranch = false;
			var pullRequest;
			for (var i = 0; i < pullRequests.length; i++) {
				if (pullRequests[i].state != "open") {
					continue;
				}
				if (pullRequests[i].base.ref != "release") {
					continue;
				}
				if (pullRequests[i].head.ref == branchName) {
					foundPRForBranch = true;
					pullRequest = pullRequests[i];
				}
			}

			if (!foundPRForBranch) {
				res.write("Push does not add to a PR.");
				res.end();
				return;
			}

			// Check the pull request has some required reviewers
			if (pullRequest.requested_reviewers.length == 0) {
				res.write("PR needs to have some required reviews. Ingoring this PR.");
				AddCommentToPR(issueCommentEndpointURL, "This PR has been setup incorrectly so will be ignored. It needs to have at least 1 reviewer.");
				ClosePullRequest(issueEndpointURL);
				res.end();
				return;
			}

			var commitsEndpointUrl = pullRequest._links.commits.href;

			// send request to get the commits in this pull request
			var cli = request.get(commitsEndpointUrl,
				{
					"headers": {
						"Authorization": "token " + GITHUB_USER_TOKEN,
						"User-Agent": GITHUB_USER_AGENT,
						"content-type": "application/json"
					}
				},
				(err, gres, body) => {
					var pullReqCommits = JSON.parse(body);
					// loop through the commits on this pull request
					for (var i = 0; i < pullReqCommits.length; i++) {

						var signature = pullReqCommits[i].commit.signature;

						// check the commit signature
						if (!VerifyCommitSignature(pullReqCommits[i])) {
							AddCommentToPR(issueCommentEndpointURL, "Commits have been pushed with an invalid or missing signature. Closing PR.");
							ClosePullRequest(issueEndpointURL);
							return;
						}
					}
			});
		}
	);
  res.write("Commit processed.");
  res.end()
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
		  new_push(req, res);
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
				"Authorization": "token " + GITHUB_USER_TOKEN,
				"User-Agent": GITHUB_USER_AGENT,
				"content-type": "application/json"
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

/* Sends request to GitHub API to add a comment to the pull request */
function SetBuildStatus(endpointURL, status) {
	request.post({
			url: endpointURL,
			headers: {
				"Authorization": "token " + GITHUB_USER_TOKEN,
				"User-Agent": GITHUB_USER_AGENT,
				"content-type": "application/json"
			},
			json: true,
			body: {
				"state": status,
        "description": "TESS build pending",
        "context":"security/tess",
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
	request.patch({
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

// To be re-checked in enclave
function VerifyCommitSignature (commit) {
	var r = commit.commit.verification;
  if(typeof r == "object" && r.verified == true){
    return true;
  }
  return false;
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
