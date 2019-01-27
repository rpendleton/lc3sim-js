(function() {
    function assert(condition) {
        if (!condition) {
            debugger;
        }
    }

    // MARK: - Constants

    var STEPS_PER_FRAME = 100000;
    var EXIT_SUCCESS = true;
    var EXIT_INPUT_TOO_LARGE = -1;
    var EXIT_OPCODE_NOT_IMPLEMENTED = -2;
    var EXIT_RETRY_AFTER_INTERRUPT = -3;

    var ADDR_INITIAL = 0x3000;
    var ADDR_KBSR = 0xfe00;
    var ADDR_KBDR = 0xfe02;
    var ADDR_DSR  = 0xfe04;
    var ADDR_DDR  = 0xfe06;
    var ADDR_MCR  = 0xfffe;
    var ADDR_MAX =  0xffff;

    var OPCODE_ADD  = 0b0001;
    var OPCODE_AND  = 0b0101;
    var OPCODE_BR   = 0b0000;
    var OPCODE_JMP  = 0b1100;
    var OPCODE_JSR  = 0b0100;
    var OPCODE_LD   = 0b0010;
    var OPCODE_LDI  = 0b1010;
    var OPCODE_LDR  = 0b0110;
    var OPCODE_LEA  = 0b1110;
    var OPCODE_NOT  = 0b1001;
    var OPCODE_RTI  = 0b1000;
    var OPCODE_ST   = 0b0011;
    var OPCODE_STI  = 0b1011;
    var OPCODE_STR  = 0b0111;
    var OPCODE_TRAP = 0b1111;
    var OPCODE_RESERVED = 0b1101;

    var REG_PC = 8;
    var REG_PSR = 9;
    var REG_COUNT = 10;

    var FLAG_NEGATIVE = 0b100;
    var FLAG_ZERO     = 0b010;
    var FLAG_POSITIVE = 0b001;

    var SIGN_BIT = 1 << 15;
    var STATUS_BIT = 1 << 15;

    // MARK: - Utilities

    function swap16(val) {
        return (val << 8) | (val >> 8);
    }

    function signExtend(val, n) {
        var m = 1 << (n - 1);
        val &= (1 << n) - 1;
        return (val ^ m) - m;
    }

    function signFlag(val) {
        if (val == 0) {
            return FLAG_ZERO;
        }
        else if (val & SIGN_BIT) {
            return FLAG_NEGATIVE;
        }
        else {
            return FLAG_POSITIVE;
        }
    }

    // MARK: - Creation

    function VirtualMachine() {
        this.mem = new Uint16Array(ADDR_MAX + 1);
        this.reg = new Uint16Array(REG_COUNT);

        this.reg[REG_PC] = ADDR_INITIAL;
        this.reg[REG_PSR] = FLAG_ZERO;
        this.mem[ADDR_MCR] = STATUS_BIT;

        this.retryAfterInterrupt = false;
    }

    // MARK: - Memory

    VirtualMachine.prototype.read = function(addr) {
        if (addr == ADDR_KBSR) {
            return this.hasChar() ? STATUS_BIT : 0;
        }
        else if (addr == ADDR_KBDR) {
            if (this.hasChar()) {
                return this.getChar();
            }
            else {
                return 0;
            }
        }
        else if (addr == ADDR_DSR) {
            return STATUS_BIT;
        }
        else if (addr == ADDR_DDR) {
            return 0;
        }
        else {
            return this.mem[addr];
        }
    };

    VirtualMachine.prototype.write = function(addr, val) {
        if (addr == ADDR_KBSR || addr == ADDR_KBDR || addr == ADDR_DSR) {
            assert(0);
        }
        else if (addr == ADDR_DDR) {
            this.putChar(val);
        }
        else {
            this.mem[addr] = val;
        }
    };

    VirtualMachine.prototype.loadOS = function() {
        var res = this.loadData(window.lc3os);
        assert(res == EXIT_SUCCESS);
    };

    VirtualMachine.prototype.loadData = function(arr8) {
        var arr16 = new Uint16Array(arr8.buffer);

        var loadAddr = swap16(arr16[0]);
        var loadLength = arr16.length - 1;

        if (loadAddr + loadLength > ADDR_MAX) {
            assert(0);
            return EXIT_INPUT_TOO_LARGE;
        }

        for (var i = 1; i < arr16.length; ++i) {
            this.mem[loadAddr + i - 1] = swap16(arr16[i]);
        }

        return EXIT_SUCCESS;
    };

    // MARK: - Execution

    VirtualMachine.prototype.setCC = function(reg) {
        this.reg[REG_PSR] = signFlag(this.reg[reg]);
    };

    VirtualMachine.prototype.perform = function(instr) {
        switch (instr >> 12) {
            case OPCODE_ADD: {
                var dr = (instr >> 9) & 0b111;
                var sr1 = (instr >> 6) & 0b111;

                if (instr & (1 << 5)) {
                    var imm5 = signExtend(instr, 5);
                    this.reg[dr] = this.reg[sr1] + imm5;
                }
                else {
                    var sr2 = instr & 0b111;
                    this.reg[dr] = this.reg[sr1] + this.reg[sr2];
                }

                this.setCC(dr);
                break;
            }

            case OPCODE_AND: {
                var dr = (instr >> 9) & 0b111;
                var sr1 = (instr >> 6) & 0b111;

                if (instr & (1 << 5)) {
                    var imm5 = signExtend(instr, 5);
                    this.reg[dr] = this.reg[sr1] & imm5;
                }
                else {
                    var sr2 = instr & 0b111;
                    this.reg[dr] = this.reg[sr1] & this.reg[sr2];
                }

                this.setCC(dr);
                break;
            }

            case OPCODE_BR: {
                var current_nzp = this.reg[REG_PSR] & 0b111;
                var desired_nzp = (instr >> 9) & 0b111;

                if (current_nzp & desired_nzp) {
                    var pc_offset9 = signExtend(instr, 9);
                    this.reg[REG_PC] += pc_offset9;
                }

                break;
            }

            case OPCODE_JMP: {
                var baser = (instr >> 6) & 0b111;
                this.reg[REG_PC] = this.reg[baser];
                break;
            }

            case OPCODE_JSR: {
                this.reg[7] = this.reg[REG_PC];

                if (instr & (1 << 11)) {
                    var pc_offset11 = signExtend(instr, 11);
                    this.reg[REG_PC] += pc_offset11;
                }
                else {
                    var baser = (instr >> 6) & 0b111;
                    this.reg[REG_PC] = this.reg[baser];
                }

                break;
            }

            case OPCODE_LD: {
                var dr = (instr >> 9) & 0b111;
                var pc_offset9 = signExtend(instr, 9);

                this.reg[dr] = this.read(this.reg[REG_PC] + pc_offset9);

                this.setCC(dr);
                break;
            }

            case OPCODE_LDI: {
                var dr = (instr >> 9) & 0b111;
                var pc_offset9 = signExtend(instr, 9);

                this.reg[dr] = this.read(this.read(this.reg[REG_PC] + pc_offset9));

                this.setCC(dr);
                break;
            }

            case OPCODE_LDR: {
                var dr = (instr >> 9) & 0b111;
                var baser = (instr >> 6) & 0b111;
                var offset6 = signExtend(instr, 6);

                this.reg[dr] = this.read(this.reg[baser] + offset6);

                this.setCC(dr);
                break;
            }

            case OPCODE_LEA: {
                var dr = (instr >> 9) & 0b111;
                var pc_offset9 = signExtend(instr, 9);

                this.reg[dr] = this.reg[REG_PC] + pc_offset9;

                this.setCC(dr);
                break;
            }

            case OPCODE_NOT: {
                var dr = (instr >> 9) & 0b111;
                var sr = (instr >> 6) & 0b111;

                this.reg[dr] = ~this.reg[sr];

                this.setCC(dr);
                break;
            }

            case OPCODE_RTI: {
                return EXIT_OPCODE_NOT_IMPLEMENTED;
            }

            case OPCODE_ST: {
                var sr = (instr >> 9) & 0b111;
                var pc_offset9 = signExtend(instr, 9);

                this.write(this.reg[REG_PC] + pc_offset9, this.reg[sr]);

                break;
            }

            case OPCODE_STI: {
                var sr = (instr >> 9) & 0b111;
                var pc_offset9 = signExtend(instr, 9);

                this.write(this.read(this.reg[REG_PC] + pc_offset9), this.reg[sr]);

                break;
            }

            case OPCODE_STR: {
                var sr = (instr >> 9) & 0b111;
                var baser = (instr >> 6) & 0b111;
                var offset6 = signExtend(instr, 6);

                this.write(this.reg[baser] + offset6, this.reg[sr]);

                break;
            }

            case OPCODE_TRAP: {
                var trapvect8 = instr & 0xff;

                if (trapvect8 == 0x20) {
                    // handle GETC efficiently to prevent high CPU usage when idle
                    if (this.hasChar()) {
                        this.reg[0] = this.getChar();
                    }
                    else {
                        return EXIT_RETRY_AFTER_INTERRUPT;
                    }
                }
                else {
                    // fallback to OS implementation of remaining traps
                    this.reg[7] = this.reg[REG_PC];
                    this.reg[REG_PC] = this.read(trapvect8);
                }

                break;
            }

            case OPCODE_RESERVED:
                return OPCODE_NOT_IMPLEMENTED;
        }

        return EXIT_SUCCESS;
    };

    VirtualMachine.prototype.step = function() {
        for (var i = 0; i < STEPS_PER_FRAME; ++i) {
            if (!(this.read(ADDR_MCR) & STATUS_BIT)) {
                // halted
                return;
            }

            var instr = this.read(this.reg[REG_PC]++);
            var res = this.perform(instr);

            if (res == EXIT_RETRY_AFTER_INTERRUPT) {
                this.reg[REG_PC]--;
                this.retryAfterInterrupt = true;
                return;
            }
            else if (res != EXIT_SUCCESS) {
                return;
            }
        }

        this.schedule();
    };

    VirtualMachine.prototype.schedule = function() {
        window.requestAnimationFrame(() => this.step());
    };

    VirtualMachine.prototype.interrupt = function() {
        if (this.retryAfterInterrupt) {
            this.retryAfterInterrupt = false;
            this.schedule();
        }
    }

    // MARK: - I/O Placeholders

    VirtualMachine.prototype.putChar = function(val) {
        console.log(val);
    }

    VirtualMachine.prototype.hasChar = function() {
        return false;
    }

    VirtualMachine.prototype.getChar = function() {
        return 0;
    }

    // MARK: - Exports

    window.VirtualMachine = VirtualMachine;
})();
