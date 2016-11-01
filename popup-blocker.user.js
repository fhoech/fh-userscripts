// ==UserScript==
// @name        Pop-Up Blocker
// @namespace   HTML
// @description Simple but effective popup window blocker. Also tries to deny involuntary redirections.
// @include     *
// @version     $Id$
// ==/UserScript==

(function () {
	var BLOCK_MODE = {'ALL': 0,  // Block all popups
										'CONFIRM': 2,  // Confirm each popup (not recommended, but useful for testing)
										'GRANT_PERIOD': 4,  // Block popups that are initiated after the mouse click grant period
										'SECURE': 8}  // Block popups from insecure (HTTP) sites
	var block_mode = BLOCK_MODE.GRANT_PERIOD | BLOCK_MODE.SECURE;
	var grant_period = 50;  // Milliseconds
	var ts = 0, wopen = window.open, showmodaldlg = window.showModalDialog;
	var lastClickedElement;

	window.addEventListener('mousedown', function (e) {
		ts = Date.now();
		lastClickedElement = e.target;
	}, true);

	window.addEventListener('click', function (e) {
		ts = Date.now();
		lastClickedElement = e.target;
	}, true);

	// Deny unsolicited redirection
	var onbeforeunload = window.onbeforeunload;
	window.onbeforeunload = function () {
		// Check if the last clicked element was a link or button, otherwise make browser ask if the user really wants to leave the page
		if (lastClickedElement &&
				!{'a': 1, 'button': 1}[lastClickedElement.tagName.toLowerCase()] &&
				Date.now() < ts + grant_period)
			return 'You are possibly involuntarily being redirected to another page. Do you want to leave ' + location.href + ' or stay?';
		else if (typeof onbeforeunload === 'function')
			return onbeforeunload();
	};

	function confirmPopup(msg, args) {
		confirm(msg + ' (' + Array.prototype.slice.apply(arguments).join(', ') + ')');
	}

	window.open = function () {
		var oargs = arguments;
		if (block_mode != BLOCK_MODE.ALL &&
				(block_mode & BLOCK_MODE.CONFIRM
				 ? confirmPopup('Allow popup?', arguments)
				 : (block_mode & BLOCK_MODE.SECURE ? location.protocol == 'https:' : true) && Date.now() < ts + grant_period)) {
			console.info('Allowed window.open', Array.prototype.slice.apply(arguments));
			return wopen.apply(window, arguments);
		}
		else {
			console.warn('Blocked window.open', Array.prototype.slice.apply(arguments));
			notify('Blocked popup window', arguments[0], arguments[1], 0, function() {
				console.info('User clicked window.open', Array.prototype.slice.apply(oargs));
				wopen.apply(window, oargs);
			});
		}
		return {}
	};

	window.showModalDialog = function () {
		if (block_mode != BLOCK_MODE.ALL &&
				(block_mode & BLOCK_MODE.CONFIRM
				 ? confirmPopup('Allow modal dialog?', arguments)
				 : (block_mode & BLOCK_MODE.SECURE ? location.protocol == 'https:' : true) && Date.now() < ts + grant_period)) {
			console.info('Allowed window.showModalDialog', Array.prototype.slice.apply(arguments));
			return showmodaldlg.apply(window, arguments);
		}
		else {
			console.warn('Blocked modal showModalDialog', Array.prototype.slice.apply(arguments));
			notify('Blocked modal dialog', arguments[0]);
		}
		return {}
	};

	function notify(text, uri, title, timeout, onclick) {
		var rootElement = document.body.parentElement,
				marginTop = parseFloat((rootElement.currentStyle || window.getComputedStyle(rootElement)).marginTop),
				notification = document.createElement('div');
		resetStyles(notification);
		notification.style.cssText = 'background: InfoBackground !important';
		notification.style.cssText += 'border-bottom: 1px solid WindowFrame !important';
		notification.style.cssText += 'box-sizing: border-box !important';
		notification.style.cssText += 'font: small-caption !important';
		notification.style.cssText += 'padding: .6em .9em !important';
		notification.style.cssText += 'position: fixed !important';
		notification.style.cssText += 'left: 0 !important';
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
		closeButton.style.cssText += 'line-height: 1.2 !important';
		closeButton.style.cssText += 'margin-left: .75em !important';
		closeButton.appendChild(document.createTextNode('╳'));
		function closeNotification() {
			rootElement.style.cssText += 'margin-top: ' + marginTop + ' !important';
			notification.style.cssText += 'top: -' + notification.offsetHeight + 'px !important';
			setTimeout(function () {
				document.body.removeChild(notification);
			}, 250);
		}
		closeButton.onclick = closeNotification;
		notification.appendChild(closeButton);
		notification.appendChild(document.createTextNode('🚫 ' + text));
		var linkText = document.createElement('a');
		resetStyles(linkText);
		linkText.style.cssText += 'color: #00e !important';
		linkText.style.cssText += 'color: -moz-nativehyperlinktext !important';
		linkText.style.cssText += 'font: inherit !important';
		linkText.style.cssText += 'text-decoration: underline !important';
		linkText.style.cssText += 'white-space: nowrap !important';
		linkText.style.cssText += 'text-overflow: ellipsis !important';
		linkText.style.cssText += 'max-width: 50% !important';
		linkText.style.cssText += 'display: inline-block !important';
		linkText.style.cssText += 'overflow: hidden !important';
		linkText.style.cssText += 'vertical-align: top !important';
		linkText.setAttribute('href', uri);
		linkText.setAttribute('target', '_blank');
		if (title) linkText.setAttribute('title', title);
		linkText.appendChild(document.createTextNode(uri));
		if (onclick) {
			linkText.onclick = function(e) {
				onclick(e);
				closeNotification();
				return false;
			}
		}
		notification.appendChild(document.createTextNode(' '));
		notification.appendChild(linkText);
		rootElement.style.cssText += 'transition: margin-top .25s !important';
		document.body.appendChild(notification);
		// Note: offsetHeight is zero while the element is not part of the document DOM tree
		notification.style.cssText += 'top: -' + notification.offsetHeight + 'px !important';
		setTimeout(function() {
			notification.style.cssText += 'top: 0 !important';
			rootElement.style.cssText += 'margin-top: ' + (marginTop + notification.offsetHeight) + 'px !important';
		}, 0)
		if (timeout) {
			setTimeout(function () {
				closeNotification();
			}, timeout);
		}
	}

	function resetStyles(element) {
		element.style.cssText = 'background: transparent !important';
		element.style.cssText += 'border: none !important';
		element.style.cssText += 'border-radius: 0 !important';
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
		element.style.cssText += 'left: auto !important';
		element.style.cssText += 'right: auto !important';
		element.style.cssText += 'top: auto !important';
		element.style.cssText += 'white-space: normal !important';
		element.style.cssText += 'width: auto !important';
	}
})();
