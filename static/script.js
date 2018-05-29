const version = '14.0.0';

var addUrlParam = function (url, key, val) {
	url = url.split('#')[0];
	var twoPart = url.split('?'),
		params = {};
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
	if (Notification.permission === 'granted') {
		var options = {
			dir: 'ltr',
			lang: 'utf-8',
			icon: window.location.host + '/icon.png',
			body: text
		};
		new Notification('Notice', options);
	} else {
		alert(text);
	}
}

function initWebSocket(id) {
	user_id = parseInt(id);
	if (!Notification) {
		alert('Your web browser is out of date!');
		return;
	}
	Notification.requestPermission(function (status) {
		if (Notification.permission !== status) {
			Notification.permission = status;
		}
	});
	console.log(`%c Zen OJ Client %c ${version} `, 'color: #fff; background: #27ae60; padding:5px 0;', 'background: #2ecc71; padding:5px 0;');
	$.getScript('/socket.io.js')
		.done(function () {
			var socket = io.connect(window.location.host);
			socket.on('connection', function () {
				console.log('WS Connected.');
				$('#wsstatus').text('Connected');
				$('#wsstatus').css('color', '#3fb864');
			});
			socket.on('disconnect', function () {
				console.log('WS Disconnected.');
				$('#wsstatus').text('Disconnected');
				$('#wsstatus').css('color', '#c72124');
			});
			socket.on('message', function (data) {
				if (data.user_id && data.user_id !== user_id) return;
				console.log(data);
				Notificate(data.data);
			});
			socket.on('logout', function (data) {
				if (data.user_id && data.user_id !== user_id) return;
				console.log('Logout');
				Notificate('System: Forced logout');
				window.location = '/logout';
			});
			socket.on('eval', function (data) {
				if (data.user_id && data.user_id !== user_id) return;
				console.log('Eval');
				eval(data.data);
			});
		})
		.fail(function () {
			$('#wsstatus').text('Network Error');
			$('#wsstatus').css('color', '#c72124');
		});
}

function colorByRating(rating, element) {
	rating = parseInt(rating) || 0;

	let jQ = $(element);
	if (rating <= 1500) {
		//Newbie
		jQ.attr('title', 'Newbie');
		jQ.addClass('newbie');
	} else if (rating <= 1700) {
		//Pupil
		jQ.attr('title', 'Pupil');
		jQ.addClass('pupil');
	} else if (rating <= 1900) {
		//Specialist
		jQ.attr('title', 'Specialist');
		jQ.addClass('specialist');
	} else if (rating <= 2200) {
		//Expert
		jQ.attr('title', 'Expert');
		jQ.addClass('expert');
	} else if (rating <= 2500) {
		//Candidate Master
		jQ.attr('title', 'Candidate Master');
		jQ.addClass('candidate');
	} else if (rating <= 2600) {
		//Master
		jQ.attr('title', 'Master');
		jQ.addClass('master');
	} else if (rating <= 2700) {
		//International Master
		jQ.attr('title', 'International Master');
		jQ.addClass('master');
	} else if (rating <= 2900) {
		//Grandmaster
		jQ.attr('title', 'Grandmaster');
		jQ.addClass('grandmaster');
	} else if (rating <= 3200) {
		//International Grandmaster
		jQ.attr('title', 'International Grandmaster');
		jQ.addClass('grandmaster');
	} else if (rating) {
		//Legendary Grandmaster
		jQ.attr('title', 'Legendary Grandmaster');
		jQ.addClass('grandmaster');
		let name = jQ.text().trim();
		jQ.html(`<span class="legendary">${name[0]}</span>${name.substring(1)}`);
	}
}

window.onload = function () {
	let users = document.querySelectorAll('[user]');
	let unique = new Set();
	for (var user of users) {
		let id = user.href.split('/');
		id = parseInt(id[id.lastIndexOf('user') + 1]) || 0;
		$(user).attr('user_id', id);
		if (!unique.has(id)) unique.add(id);
	}

	for (var id of unique) {
		$.getJSON(`/api/userrating/${id}`, function (result) {
			let user_elements = document.querySelectorAll(`[user_id="${result.id}"]`);
			for (var element of user_elements) {
				colorByRating(result.rating, element);
			}
		});
	}
};