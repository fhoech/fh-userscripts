// ==UserScript==
// @name        Pop-Up Blocker
// @namespace   HTML
// @include     *
// @version     $Id:$
// ==/UserScript==

(function () {
	var BLOCK_MODE = {'ALL': 0,  // Block all popups
										'CONFIRM': 2,  // Confirm each popup (not recommended, but useful for testing)
									  'GRANT_PERIOD': 4,  // Block popups that are initiated after the mouse click grant period
                    'SECURE': 8}  // Block popups from insecure (HTTP) sites
	var block_mode = BLOCK_MODE.GRANT_PERIOD | BLOCK_MODE.SECURE;
	var grant_period = 50;  // Milliseconds
	var ts = 0, wopen = window.open, showmodaldlg = window.showModalDialog;

	window.addEventListener('mousedown', function () {
		ts = Date.now();
	}, true);

	window.addEventListener('click', function () {
		ts = Date.now();
	}, true);

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
			notify('Blocked popup window', arguments[0], 0, function() {
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

	// Notifications
	function notificationDetails(title, text, timeout, onclick) {
		return {
			'text': text || '',
			'title': title || '',
			'timeout': timeout || 0,
			'onclick': onclick || function () {
			}
		};
	}

	function notify(title, text, timeout, onclick) {
		//GM_notification(notificationDetails(title, text, timeout, onclick));
    var notification = document.createElement('div');
    resetStyles(notification);
    notification.style.cssText = 'background: InfoBackground !important';
    notification.style.cssText += 'border-bottom: 1px solid WindowFrame !important';
    notification.style.cssText += 'box-sizing: border-box !important';
    notification.style.cssText += 'font: small-caption !important';
    notification.style.cssText += 'padding: .6em .9em !important';
    notification.style.cssText += 'position: fixed !important';
    notification.style.cssText += 'left: 0 !important';
    notification.style.cssText += 'right: 0 !important';
    notification.style.cssText += 'top: 0 !important';
    notification.style.cssText += 'width: 100% !important';
    var closeButton = document.createElement('span');
    resetStyles(closeButton);
    closeButton.style.cssText += 'cursor: pointer !important';
    closeButton.style.cssText += 'display: inline-block !important';
    closeButton.style.cssText += 'float: right !important';
    closeButton.style.cssText += 'font: inherit !important';
    closeButton.style.cssText += 'margin-left: .75em !important';
    closeButton.appendChild(document.createTextNode('╳'));
    closeButton.onclick = function () {
      document.body.removeChild(notification);
    }
    notification.appendChild(closeButton);
    notification.appendChild(document.createTextNode(title));
    var linkText = document.createElement('span');
    resetStyles(linkText);
    linkText.style.cssText += 'color: #00e !important';
    linkText.style.cssText += 'color: -moz-nativehyperlinktext !important';
    linkText.style.cssText += 'cursor: pointer !important';
    linkText.style.cssText += 'font: inherit !important';
    linkText.style.cssText += 'text-decoration: underline !important';
    linkText.appendChild(document.createTextNode(text));
    if (onclick) {
      linkText.onclick = function(e) {
        onclick(e);
        document.body.removeChild(notification);
      }
    }
    notification.appendChild(document.createTextNode(' '));
    notification.appendChild(linkText);
    document.body.appendChild(notification);
    if (timeout) {
      notification.style.cssText += 'transition: opacity .25s !important';
      setTimeout(function () {
        notification.style.cssText += 'opacity: 0 !important';
      }, timeout);
      setTimeout(function () {
        document.body.removeChild(notification);
      }, timeout + .25 * 1000);
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

  function shim_GM_notification() {
    if (typeof GM_notification === "function") return;

    window.GM_notification = function (options) {
			function checkPermission() {
				if (Notification.permission === "granted") {
					showNotification();
				}
				else if (Notification.permission === "denied") {
					console.error("User has denied notifications for this page/site!");
					return;
				}
				else {
					Notification.requestPermission(function (permission) {
						console.info("Requested permission to show notification", permission);
						checkPermission();
					});
				}
			}
			checkPermission();

			function showNotification() {
				if (!options.title) {
					console.error("A title is required for a notification!");
					return;
				}
				if (options.text && !options.body) {
					options.body = options.text;
				}

				var notification = new Notification(options.title, options);

				if (options.onclick) {
					notification.onclick = options.onclick;
				}
				if (options.timeout) {
					setTimeout(function() {
						notification.close();
					}, options.timeout);
				}
			}
    }
	}
	//shim_GM_notification();
})();
