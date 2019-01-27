(function() {
    var vm = new VirtualMachine();

    var term = new Terminal();
    term.open(document.getElementById('terminal'));
    term.write('Choose a game to begin.\r\n');

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
        term.focus();

        vm.reset();
        availableKeys = [];

        vm.loadOS();
        vm.loadData(program);
        vm.schedule();
    }

    window.restartAndLoad = restartAndLoad;
})();
