class Vector {
    x = 0;
    y = 0;

    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static magnitude(vec) {
        return Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.y, 2));
    }
    static normalize(vec) {
        let mag = Vector.magnitude(vec)
        if (mag == 0)
            return vec;
        return Vector.div(vec, mag);
    }

    static dist(a, b) {
        return Vector.magnitude(Vector.diff(b, a));
    }

    static div(vec, num) {
        return new Vector(vec.x / num, vec.y / num);
    }

    static diff(a, b) {
        return new Vector(a.x - b.x, a.y - b.y);
    }
}