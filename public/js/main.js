
var baseAddress = "http://tess.westeurope.cloudapp.azure.com:8000";

function AddRepo_Pressed () {
	var repoName = document.getElementById("create_repoNameInput").value;
	var endpoint = baseAddress + "/user/repos";

	document.getElementById("Loading").style.display = "block";
	document.getElementById("buttons").style.display = "none";

	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open("POST", endpoint);
	xhrRequest.onreadystatechange =  () => AddRepo_Resp(xhrRequest);
	xhrRequest.setRequestHeader("Access-Control-Allow-Origin", "*");
	xhrRequest.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	xhrRequest.send(JSON.stringify(
	{ 
		"name": repoName,
	}
	));
}

function AddRepo_Resp (xhrRequest) {
	document.getElementById("Loading").style.display = "none";
	document.getElementById("buttons").style.display = "block";
	switch(xhrRequest.status) {
		case 200:
			showModal("Success!", "Your repo has been created.");
			break;
		default:
			showModal("Something Went Wrong", "Status Code: " + xhrRequest.status);
	}
}


function DeleteRepo_Pressed () {
	var repoName = document.getElementById("delete_repoNameInput").value;
	var endpoint = baseAddress + "/repos/transparent-enclave/" + repoName;

	document.getElementById("Loading").style.display = "block";
	document.getElementById("buttons").style.display = "none";

	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open("DELETE", endpoint);
	xhrRequest.onreadystatechange =  () => DeleteRepo_Resp(xhrRequest);
	xhrRequest.setRequestHeader("Access-Control-Allow-Origin", "*");
	//xhrRequest.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	xhrRequest.send();
}

function DeleteRepo_Resp (xhrRequest) {
	document.getElementById("Loading").style.display = "none";
	document.getElementById("buttons").style.display = "block";
	switch(xhrRequest.status) {
		case 200:
			showModal("Success!", "The repo has been deleted.");
			break;
		default:
			showModal("Something Went Wrong", "Status Code: " + xhrRequest.status);
	}
}

function EditRepo_Pressed () {
	var repoName = document.getElementById("edit_repoNameInput").value;
	var jsonBody = document.getElementById("edit_jsonInput").value;
	var endpoint = baseAddress + "/repos/transparent-enclave/" + repoName;

	document.getElementById("Loading").style.display = "block";
	document.getElementById("buttons").style.display = "none";

	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open("PATCH", endpoint);
	xhrRequest.onreadystatechange =  () => EditRepo_Resp(xhrRequest);
	xhrRequest.setRequestHeader("Access-Control-Allow-Origin", "*");
	xhrRequest.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	xhrRequest.send(jsonBody);
}

function EditRepo_Resp (xhrRequest) {
	document.getElementById("Loading").style.display = "none";
	document.getElementById("buttons").style.display = "block";
	switch(xhrRequest.status) {
		case 200:
			showModal("Success!", "The repo has been edited.");
			break;
		default:
			showModal("Something Went Wrong", "Status Code: " + xhrRequest.status);
	}
}

function reposNavChange(button) {
	currentValue = button.value;
	switch(currentValue) {
		case "1":
		document.getElementById("create").style.display = "block";
		document.getElementById("edit").style.display = "none";
		document.getElementById("delete").style.display = "none";
		break;
		case "2":
		document.getElementById("create").style.display = "none";
		document.getElementById("edit").style.display = "block";
		document.getElementById("delete").style.display = "none";
		break;
		case "3":
		document.getElementById("create").style.display = "none";
		document.getElementById("edit").style.display = "none";
		document.getElementById("delete").style.display = "block";
		break;
	} 
}

function collabNavChange(button) {
	currentValue = button.value;
	switch(currentValue) {
		case "1":
		document.getElementById("add").style.display = "block";
		document.getElementById("remove").style.display = "none";
		break;
		case "2":
		document.getElementById("add").style.display = "none";
		document.getElementById("remove").style.display = "block";
		break;
	} 
}

function showModal(title, content) {
	document.getElementById("modalTitle").innerHTML = title;
	document.getElementById("modalContent").innerHTML = content;
	var options = {};
	$('#reposModal').modal(options);
}


function AddCollaborator_Pressed () {
	var collaboratorUsername = document.getElementById("add_collabUser").value;
	var repoName = document.getElementById("add_collabRepo").value;
	var endpoint = baseAddress + "/repos/transparent-enclave/" + repoName + "/collaborators/" + collaboratorUsername;

	document.getElementById("Loading").style.display = "block";
	document.getElementById("buttons").style.display = "none";

	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open("PUT", endpoint);
	xhrRequest.onreadystatechange =  () => AddCollaborator_Resp(xhrRequest);
	xhrRequest.setRequestHeader("Access-Control-Allow-Origin", "*");
	xhrRequest.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	xhrRequest.send();
}

function AddCollaborator_Resp (xhrRequest) {
	document.getElementById("Loading").style.display = "none";
	document.getElementById("buttons").style.display = "block";
	switch(xhrRequest.status) {
		case 200:
			showModal("Success!", "Collaborator has been added.");
			break;
		default:
			showModal("Something Went Wrong", "Status Code: " + xhrRequest.status);
	}
}


function DeleteCollaborator_Pressed () {
	var collaboratorUsername = document.getElementById("remove_collabUser").value;
	var repoName = document.getElementById("remove_collabRepo").value;
	var endpoint = baseAddress + "/repos/transparent-enclave/" + repoName + "/collaborators/" + collaboratorUsername;

	document.getElementById("Loading").style.display = "block";
	document.getElementById("buttons").style.display = "none";

	var xhrRequest = new XMLHttpRequest();
	xhrRequest.open("DELETE", endpoint);
	xhrRequest.onreadystatechange =  () => DeleteCollaborator_Resp(xhrRequest);
	xhrRequest.setRequestHeader("Access-Control-Allow-Origin", "*");
	xhrRequest.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	xhrRequest.send();
}

function DeleteCollaborator_Resp (xhrRequest) {
	document.getElementById("Loading").style.display = "none";
	document.getElementById("buttons").style.display = "block";
	switch(xhrRequest.status) {
		case 200:
			showModal("Success!", "Collaborator has been removed.");
			break;
		default:
			showModal("Something Went Wrong", "Status Code: " + xhrRequest.status);
	}
}
