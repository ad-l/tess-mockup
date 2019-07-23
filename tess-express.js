// Routing
var express = require('express')
var app = express()
app.use(express.json())
const port = 8000

// Github Requests
var request = require("request");


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

// Github User
GITHUB_USER_TOKEN = "072d3445cf3bc85d165e85b19f6a40fa55fccef2";
GITHUB_USER_AGENT = "TESS";
GITHUB_USER = "transparent-enclave";

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
    request.delete({
        url: "https://api.github.com" + EP_DELETE_REPO.replace(":owner", req.params.owner).replace(":repo", req.params.repo),
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
        url: "https://api.github.com" + EP_EDIT_REPO.replace(":owner", req.params.owner).replace(":repo", req.params.repo),
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



app.listen(port, () => console.log(`Listening on port ${port}!`));