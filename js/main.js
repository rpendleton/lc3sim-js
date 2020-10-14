(function() {
    var vm = new VirtualMachine();

    Terminal.applyAddon(fit);

    var term = new Terminal({
        theme: {
            background: '#1f1f1f'
        }
    });

    var termContainer = document.getElementById('terminal');
    term.open(termContainer);
    term.write('Choose a game to begin.\r\n');
    term.fit();

    // MARK: - display

    var pendingWrites = '';

    vm.putChar = function(val) {
        var char = String.fromCharCode(val);
        if (char === '\n') char = '\r\n';

        if (pendingWrites.length == 0) {
            window.requestAnimationFrame(() => {
                term.write(pendingWrites);
                pendingWrites = [];
            });
        }

        pendingWrites += char;
    };

    // MARK: - input

    var supportsTouch = 'ontouchstart' in document;
    var availableKeys = [];

    term.on('key', function(char, e) { // eslint-disable-line no-unused-vars
        if (char === '\r') char = '\n';

        availableKeys.push(char.charCodeAt(0));
        vm.interrupt();
    });

    vm.hasChar = function() {
        return availableKeys.length > 0;
    };

    vm.getChar = function() {
        if (availableKeys.length > 0) {
            return availableKeys.splice(0, 1)[0];
        }
        else {
            return 0;
        }
    };

    // MARK: - loading

    function restartAndLoad(program) {
        term.clear();

        if (!supportsTouch) {
            term.focus();
        }

        vm.reset();
        availableKeys = [];

        vm.loadOS();
        vm.loadData(program);
        vm.schedule();
    }

    window.restartAndLoad = restartAndLoad;

    // MARK: - gestures

    function recognizeGesture(touchStart, touchEnd) {
        // If both deltas are >= this threshold, we'll consider the swipe to be
        // diagonal and cancel it.
        var swipeDiagonalThreshold = 50;

        // If one of the detals is >= this threshold and the other is < the
        // diagonal threshold, we'll consider the swipe to be valid.
        var swipeMinimumThreshold = 75;
        var swipeThreshold = 75;

        var deltaX = touchEnd.x - touchStart.x;
        var deltaY = touchEnd.y - touchStart.y;

        if (Math.abs(deltaX) >= swipeMinimumThreshold && Math.abs(deltaY) < swipeDiagonalThreshold) {
            return deltaX > 0 ? 'd' : 'a';
        }
        else if (Math.abs(deltaY) >= swipeMinimumThreshold && Math.abs(deltaX) < swipeDiagonalThreshold) {
            return deltaY > 0 ? 's' : 'w';
        }
        else {
            return null;
        }
    }

    if (supportsTouch) {
        var touchStart;

        termContainer.addEventListener('touchstart', function(e) {
            touchStart = {
                x: e.changedTouches[0].screenX,
                y: e.changedTouches[0].screenY
            };
        });

        termContainer.addEventListener('touchend', function(e) {
            var touchEnd = {
                x: e.changedTouches[0].screenX,
                y: e.changedTouches[0].screenY
            };

            var recognizedGestureKey = recognizeGesture(touchStart, touchEnd);
            touchStart = null;

            if (recognizedGestureKey !== null) {
                availableKeys.push(recognizedGestureKey.charCodeAt(0));
                vm.interrupt();
            }
        });
    }
})();
