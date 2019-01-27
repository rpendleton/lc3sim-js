(function() {
    var vm = new VirtualMachine();
    vm.loadOS();
    vm.loadData(lc3_2048);

    var term = new Terminal();
    term.open(document.getElementById('terminal'));

    // MARK: - display

    vm.putChar = function(val) {
        var char = String.fromCharCode(val);
        if (char === '\n') char = '\r\n';

        term.write(char);
    };

    // MARK: - input

    var availableKeys = [];

    term.on('key', function(char, e) {
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

    // MARK: - start

    vm.schedule();
    term.focus();
})();
