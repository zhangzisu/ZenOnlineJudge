var addUrlParam = function (url, key, val) {
	var newParam = encodeURIComponent(key) + '=' + encodeURIComponent(val);
	url = url.split('#')[0];
	var twoPart = url.split('?'), params = {};
	var tmp = twoPart[1] ? twoPart[1].split('&') : [];
	for (let i in tmp) {
		let a = tmp[i].split('=');
		params[a[0]] = a[1];
	}
	params[key] = val;
	url = twoPart[0] + '?';
	for (let key in params) {
		url += encodeURIComponent(key) + '=' + encodeURIComponent(params[key]) + '&';
	}
	url = url.substring(0, url.length - 1);
	return url;
};
$(function () {
	$(document).on('click', 'a[href-post]', function (e) {
		e.preventDefault();
		var form = document.createElement('form');
		form.style.display = 'none';
		form.method = 'post';
		form.action = $(this).attr('href-post');
		form.target = '_self';
		var input = document.createElement('input');
		input.type = 'hidden';
		input.name = '_csrf';
		input.value = document.head.getAttribute('data-csrf-token');
		form.appendChild(input);
		document.body.appendChild(form);
		form.submit();
	});
	$('form').each(function () {
		this.action = addUrlParam(this.action || location.href, '_csrf', document.head.getAttribute('data-csrf-token'));
	});
});
function Notificate(text) {
	if (Notification.permission === "granted") {
		var options = {
			dir: "ltr",
			lang: "utf-8",
			icon: window.location.host + '/icon.png',
			body: text
		};
		var n = new Notification("Notice", options);
	} else {
		alert(text);
	}
}
function initWebSocket() {
	if (!Notification) {
		alert("Your web browser is out of date!");
		return;
	}
	Notification.requestPermission(function (status) {
		if (Notification.permission !== status) {
			Notification.permission = status;
		}
	});
	$.getScript("/socket.io.js")
		.done(function (script, textStatus) {
			var socket = io.connect(window.location.host);
			socket.on('message', function (data) {
				console.log(data);
				Notificate(data.data);
			});
			socket.on('connection', function (data) {
				console.log("WS Connected.");
				$('#wsstatus').text('Connected');
				$('#wsstatus').css('color', '#3fb864');
			});
			socket.on('disconnect', function (data) {
				console.log("WS Disconnected.");
				$('#wsstatus').text('Disconnected');
				$('#wsstatus').css('color', '#c72124');
				Notificate('Network error, connection closed.');
			});
			socket.on('logout', function (data) {
				window.location = "/logout";
			});
		})
		.fail(function (jqxhr, settings, exception) {
			Notificate('Network error!');
			$('#wsstatus').text('Error');
			$('#wsstatus').css('color', '#c72124');
		});
}