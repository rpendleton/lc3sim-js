(function() {
    var vm = new VirtualMachine();
    vm.loadOS();
    vm.loadData(lc3_2048);

    var term = new Terminal();
    term.open(document.getElementById('terminal'));

    // MARK: - display

    vm.putChar = function(val) {
        var s = String.fromCharCode(val);

        if (s == '\n') {
            term.write('\r\n');
        }
        else {
            term.write(s);
        }
    };

    // MARK: - input

    var availableKeys = [];

    term.on('key', function(key, e) {
        availableKeys.push(key.charCodeAt(0));
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
