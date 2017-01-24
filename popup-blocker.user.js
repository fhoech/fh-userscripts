// ==UserScript==
// @name        Pop-Up Blocker
// @namespace   HTML
// @description Simple but effective popup window blocker. Also tries to deny unsolicited redirections.
// @include     *
// @version     $Id$
// ==/UserScript==

(function () {
	var BLOCK_MODE = {'ALL': 0,  // Block all popups
										'CONFIRM': 2,  // Confirm each popup (not recommended, but useful for testing)
										'GRANT_PERIOD': 4,  // Block popups that are initiated after the mouse click grant period
										'INSECURE': 8}  // Block popups from insecure (HTTP) sites

	// Configuration
	var block_mode = BLOCK_MODE.GRANT_PERIOD | BLOCK_MODE.INSECURE;
	var grant_period = 100;  // Milliseconds
	var debug = true;  // Enable debug logging

	// DO NOT CHANGE BELOW THIS POINT
	var allowed_elements = {'a': 1, 'button': 0, 'input': 1, 'select': 1, 'option': 1};
	var ts = 0, wopen = window.open, showmodaldlg = window.showModalDialog;
	var lastInteractedElement;
	var marginTop = null;
	var notifications = 0;
	var notificationOffsetTop = 0;

	window.addEventListener('mousedown', function (event) {
		ts = Date.now();
		if (debug) console.info('Mouse button', event.button != null ? event.button : event.which, 'down on', event.target);
		setlastInteractedElement(event);
		//mediateEventPropagation(event);
	}, true);

	window.addEventListener('click', function (event) {
		ts = Date.now();
		if (debug) console.info('Mouse button', event.button != null ? event.button : event.which, 'click on', event.target);
		setlastInteractedElement(event);
		//mediateEventPropagation(event);
	}, true);

	window.addEventListener('change', function (event) {
		ts = Date.now();
		if (debug) console.info('Changed selection on', event.target);
		setlastInteractedElement(event);
		//mediateEventPropagation(event);
	}, true);

	function setlastInteractedElement(event) {
		// Deal with tags nested in (e.g.) links
		var element = event.target;
		if (event instanceof MouseEvent && (event.button != null ? event.button != 0 : event.which != 1)) return;
		while (element.parentElement && element.tagName && !allowed_elements[element.tagName.toLowerCase()]) {
			element = element.parentElement;
		}
		lastInteractedElement = element;
		if (debug) console.info('Last interacted element', element);
	}

	function mediateEventPropagation(event) {
		// Stop event propagation if element has a 'href' attribute that does not point to the current document
		// (prevents click hijacking)
		if ((block_mode & BLOCK_MODE.INSECURE ? location.protocol != 'https:' : true) &&
			lastInteractedElement &&
			lastInteractedElement.href &&
			boildown(lastInteractedElement.href) != boildown(window.location.href) &&
			lastInteractedElement.href.indexOf('javascript:') !== 0) {
			event.stopPropagation();
			console.warn('Pop-Up Blocker stopped event propagation for', event);
		}
	}

	function regExpEscape(s) {
		return String(s).replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, '\\$1').
			replace(/\x08/g, '\\x08');
	};

	var regExpProtHostPathQ = new RegExp('^((' + regExpEscape(location.protocol) + '//' + regExpEscape(location.host) + ')?' +
										    '(' + regExpEscape(location.pathname) + ')?)?');

	function boildown(uri) {
		var uri_boileddown = uri.replace(regExpProtHostPathQ, '');  // Strip current protocol + host + path
		uri_boileddown = uri_boileddown.replace(/#.*$/, '');  // Strip any hash
		// Sort query vars
		var query = uri_boileddown.match(/\?[^?]+/);
		if (query)
			query = '?' + query[0].substr(1).split('&').sort().join('&');
		uri_boileddown = uri_boileddown.replace(/\?[^?]+/, query || '');
		return uri_boileddown;
	};

	// Deny unsolicited redirection
	if (typeof window.location.watch == 'function') window.location.watch(
		'href',
		function (id, oldval, newval) {
			var href_boileddown, newval_boileddown = boildown(newval);
			console.info('location.' + id, '->', newval);
			if (lastInteractedElement && lastInteractedElement.tagName &&
				lastInteractedElement.tagName.toLowerCase() == 'a')
				href_boileddown = boildown(lastInteractedElement.href);
			var link_hijacked = href_boileddown != undefined && newval.indexOf('#') !== 0 && newval_boileddown != href_boileddown;
				grantperiod_exceeded = (Date.now() > ts + grant_period && link_hijacked);
				
			if (debug) {
				console.info('Page secure?', location.protocol == 'https:');
				console.info('Allow insecure page?', block_mode & BLOCK_MODE.INSECURE ? false : true);
				console.info('Last interacted element?', lastInteractedElement);
				if (lastInteractedElement) {
					console.info('Last interacted element tag name?', lastInteractedElement.tagName);
					if (lastInteractedElement.tagName) {
						console.info('Allowed element?', !!allowed_elements[lastInteractedElement.tagName.toLowerCase()]);
						console.info('Last interacted element is link?', lastInteractedElement.tagName.toLowerCase() == 'a');
						if (lastInteractedElement.tagName.toLowerCase() == 'a') {
							console.info('New location (boiled down) =', newval_boileddown);
							console.info('Link HREF (boiled down) =', href_boileddown);
							console.info('New location is the same as link HREF?', newval_boileddown == href_boileddown);
							console.info('Link target is a new window?', lastInteractedElement.target == '_blank');
						}
					}
				}
				console.info('Grant period exceeded?', grantperiod_exceeded);
			}
			if ((block_mode & BLOCK_MODE.INSECURE ? location.protocol != 'https:' : true) &&
				(!lastInteractedElement ||
				 (lastInteractedElement.tagName &&
				  (!allowed_elements[lastInteractedElement.tagName.toLowerCase()] ||
				   (lastInteractedElement.tagName.toLowerCase() == 'a' &&
				    (link_hijacked ||
				     lastInteractedElement.target == '_blank')))) ||
				 grantperiod_exceeded)) {
				notify('Denied redirection to', newval, null, 0, null, '_self');
				console.error('Pop-Up Blocker denied redirection to ' + newval);
				return '#' + location.hash.replace(/^#/, '');
			}
			return newval;
		}
	);

	var onbeforeunload = window.onbeforeunload;
	window.onbeforeunload = function () {
		// Check if the last interacted element was a link or button, otherwise make browser ask if the user really wants to leave the page
		if (lastInteractedElement && lastInteractedElement.tagName &&
				!allowed_elements[lastInteractedElement.tagName.toLowerCase()] &&
				(block_mode & BLOCK_MODE.INSECURE ? location.protocol != 'https:' : true) && Date.now() <= ts + grant_period) {
			if (debug) {
				console.info('Page secure?', location.protocol == 'https:');
				console.info('Allow insecure page?', block_mode & BLOCK_MODE.INSECURE ? false : true);
					console.info('Last interacted element?', lastInteractedElement);
					if (lastInteractedElement) {
						console.info('Last interacted element tag name?', lastInteractedElement.tagName);
						if (lastInteractedElement.tagName) {
							console.info('Allowed element?', !!allowed_elements[lastInteractedElement.tagName.toLowerCase()]);
						}
					}
					console.info('Grant period exceeded?', Date.now() > ts + grant_period);
			}
			return 'You are possibly involuntarily being redirected to another page. Do you want to leave ' + location.href + ' or stay?';
		}
		else if (typeof onbeforeunload === 'function')
			return onbeforeunload.apply(window, arguments);
	};

	function confirmPopup(msg, args) {
		confirm(msg + ' (' + Array.prototype.slice.apply(arguments).join(', ') + ')');
	}

	window.open = function () {
		var oargs = arguments;
		if (debug) {
			console.info('Page secure?', location.protocol == 'https:');
			console.info('Allow insecure page?', block_mode & BLOCK_MODE.INSECURE ? false : true);
			console.info('Grant period exceeded?', Date.now() > ts + grant_period);
		}
		if (['_self', '_parent', '_top'].includes(arguments[1]) ||
			(block_mode != BLOCK_MODE.ALL &&
				(block_mode & BLOCK_MODE.CONFIRM
				 ? confirmPopup('Allow popup?', arguments)
				 : (block_mode & BLOCK_MODE.INSECURE ? location.protocol == 'https:' : true) && Date.now() <= ts + grant_period))) {
			console.info('Pop-Up Blocker allowed window.open', Array.prototype.slice.apply(arguments));
			return wopen.apply(window, arguments);
		}
		else {
			console.warn('Pop-Up Blocker blocked window.open', Array.prototype.slice.apply(arguments));
			notify('Blocked popup window', arguments[0], arguments[1], 0, function() {
				console.info('Pop-Up Blocker user clicked window.open', Array.prototype.slice.apply(oargs));
				wopen.apply(window, oargs);
			});
		}
		return {}
	};

	window.showModalDialog = function () {
		if (debug) {
			console.info('Page secure?', location.protocol == 'https:');
			console.info('Allow insecure page?', block_mode & BLOCK_MODE.INSECURE ? false : true);
			console.info('Grant period exceeded?', Date.now() > ts + grant_period);
		}
		if (block_mode != BLOCK_MODE.ALL &&
				(block_mode & BLOCK_MODE.CONFIRM
				 ? confirmPopup('Allow modal dialog?', arguments)
				 : (block_mode & BLOCK_MODE.INSECURE ? location.protocol == 'https:' : true) && Date.now() <= ts + grant_period)) {
			console.info('Pop-Up Blocker allowed window.showModalDialog', Array.prototype.slice.apply(arguments));
			return showmodaldlg.apply(window, arguments);
		}
		else {
			console.warn('Pop-Up Blocker blocked modal showModalDialog', Array.prototype.slice.apply(arguments));
			notify('Blocked modal dialog', arguments[0], null, 0, function() {
				console.info('Pop-Up Blocker user clicked window.showModalDialog', Array.prototype.slice.apply(oargs));
				showmodaldlg.apply(window, oargs);
			});
		}
		return {}
	};

	function notify(text, uri, title, timeout, onclick, target) {
		var rootElement = document.body.parentElement,
				notification = document.createElement('div');
		if (marginTop === null) marginTop = parseFloat((rootElement.currentStyle || window.getComputedStyle(rootElement)).marginTop)
		resetStyles(notification);
		notification.style.cssText += 'background: InfoBackground !important';
		notification.style.cssText += 'border-bottom: 1px solid WindowFrame !important';
		notification.style.cssText += 'box-sizing: border-box !important';
		notification.style.cssText += 'font: small-caption !important';
		notification.style.cssText += 'padding: .15em .9em !important';
		notification.style.cssText += 'position: fixed !important';
		notification.style.cssText += 'left: 0 !important';
		notification.style.cssText += 'line-height: 2.3 !important';  // 31px
		notification.style.cssText += 'right: 0 !important';
		notification.style.cssText += 'top: -100% !important';
		notification.style.cssText += 'transition: top .25s !important';
		notification.style.cssText += 'width: 100% !important';
		notification.style.cssText += 'white-space: nowrap !important';
		notification.style.cssText += 'z-index: 2147483647 !important';
		var closeButton = document.createElement('span');
		resetStyles(closeButton);
		closeButton.style.cssText += 'cursor: pointer !important';
		closeButton.style.cssText += 'display: inline-block !important';
		closeButton.style.cssText += 'float: right !important';
		closeButton.style.cssText += 'font: inherit !important';
		closeButton.style.cssText += 'line-height: 2.1 !important';
		closeButton.style.cssText += 'margin-left: .75em !important';
		closeButton.appendChild(document.createTextNode('╳'));
		function closeNotification(event) {
			if (event) event.stopPropagation();
			//notificationOffsetTop -= notification.offsetHeight;
			if (!--notifications) rootElement.style.cssText += 'margin-top: ' + marginTop + ' !important';
			notification.style.cssText += 'top: -' + notification.offsetHeight + 'px !important';
			setTimeout(function () {
				document.body.removeChild(notification);
			}, 250);
			return false;
		}
		closeButton.onclick = closeNotification;
		notification.appendChild(closeButton);
		notification.appendChild(document.createTextNode('🚫 ' + text));
		var numLinks = target == '_self' ? 1 : 2;
		for (var i = 0; i < numLinks; i ++) {
			var popupLink = document.createElement(!i ? 'a' : 'button');
			resetStyles(popupLink);
			if (i) {
				popupLink.style.cssText += '-moz-appearance: button !important';
				popupLink.style.cssText += '-webkit-appearance: button !important';
				popupLink.style.cssText += 'appearance: button !important';
				popupLink.style.cssText += 'font: small-caption !important';
			}
			else {
				popupLink.style.cssText += 'color: #00e !important';
				popupLink.style.cssText += 'color: -moz-nativehyperlinktext !important';
				popupLink.style.cssText += 'display: inline-block !important';
				popupLink.style.cssText += 'font: inherit !important';
				popupLink.style.cssText += 'max-width: 50% !important';
				popupLink.style.cssText += 'overflow: hidden !important';
				popupLink.style.cssText += 'text-decoration: underline !important';
				popupLink.style.cssText += 'text-overflow: ellipsis !important';
				popupLink.style.cssText += 'vertical-align: bottom !important';
				popupLink.style.cssText += 'white-space: nowrap !important';
				popupLink.setAttribute('href', uri);
				popupLink.setAttribute('target', target || '_blank');
			}
			if (title) popupLink.setAttribute('title', title);
			var linkText = i ? 'Open in this frame' : uri;
			popupLink.appendChild(document.createTextNode(linkText));
			popupLink.onclick = function(event) {
				event.stopPropagation();
				closeNotification();
				if (this.tagName.toLowerCase() != 'a') {
					location.href = uri;
				}
				else if (onclick) {
					onclick(event);
					return false;
				}
			};
			notification.appendChild(document.createTextNode(' '));
			notification.appendChild(popupLink);
		}
		if (!notifications) rootElement.style.cssText += 'transition: margin-top .25s !important';
		document.body.appendChild(notification);
		// Note: offsetHeight is zero while the element is not part of the document DOM tree
		notification.style.cssText += 'top: -' + notification.offsetHeight + 'px !important';
		setTimeout(function() {
			//notificationOffsetTop += notification.offsetHeight;
			notification.style.cssText += 'top: ' + notificationOffsetTop + 'px !important';
			if (!notifications) rootElement.style.cssText += 'margin-top: ' + (marginTop + notification.offsetHeight) + 'px !important';
			notifications ++;
		}, 0)
		if (timeout) {
			setTimeout(function () {
				closeNotification();
			}, timeout);
		}
	}

	function resetStyles(element) {
		if (element.tagName.toLowerCase() != 'button') {
			element.style.cssText = 'background: transparent !important';
			element.style.cssText += 'border: none !important';
			element.style.cssText += 'border-radius: 0 !important';
		}
		element.style.cssText += 'bottom: auto !important';
		element.style.cssText += 'box-shadow: none !important';
		element.style.cssText += 'color: WindowText !important';
		element.style.cssText += 'font: medium serif !important';
		element.style.cssText += 'line-height: normal !important';
		element.style.cssText += 'margin: 0 !important';
		element.style.cssText += 'opacity: 1 !important';
		element.style.cssText += 'outline: none !important';
		element.style.cssText += 'padding: 0 !important';
		element.style.cssText += 'position: static !important';
		element.style.cssText += 'text-align: left !important';
		element.style.cssText += 'text-shadow: none !important';
		element.style.cssText += 'text-transform: none !important';
		element.style.cssText += 'left: auto !important';
		element.style.cssText += 'right: auto !important';
		element.style.cssText += 'top: auto !important';
		element.style.cssText += 'white-space: normal !important';
		element.style.cssText += 'width: auto !important';
	}
})();
