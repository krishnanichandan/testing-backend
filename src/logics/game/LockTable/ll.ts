// @ts-nocheck
export function LinkedList() {
    this.head = null;
    this.last = this.head;
    this.length = 0;
};


LinkedList.prototype.push = function (obj) {
    var elm = {
        data: obj,
        nextElm: null
    };
    if (!!this.last) {
        this.last.nextElm = elm;
        this.last = elm;
    } else {
        this.head = this.last = elm;
    }
    this.length++;
    return this;
};


LinkedList.prototype.shift = function () {
    var p;
    if (!!this.head) {
        p = this.head.data;
        this.head = this.head.nextElm;
        if (!this.head) {
            this.last = this.head;
        }
        this.length--;
    }
    return p;
};

LinkedList.prototype.firstElm = function () {
    var p;
    if (!!this.head) {
        p = this.head.data;
    }
    return p;
};



LinkedList.prototype.print = function () {
    for (var c = this.head && this.head; console.log(c && c.data), c && c.nextElm; c = c.nextElm) { }
    return;
};



LinkedList.prototype.toArray = function () {
    var r = [];
    for (var c = this.head && this.head; c && c.data && r.push(c.data), c && c.nextElm; c = c.nextElm) { }
    return r;
};

// module.exports = LinkedList;
// exports.LinkedList = LinkedList;