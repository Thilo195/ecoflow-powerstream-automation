export class PID {
    constructor({ kp, ki, kd, outputMin = -Infinity, outputMax = Infinity }) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
        this.outputMin = outputMin;
        this.outputMax = outputMax;

        this.integral = 0;
        this.previousError = 0;
        this.previousTime = null;
    }

    /**
     * @param {number} setpoint
     * @param {number} measurement
     * @param {number} [now] 
     * @returns {number} 
     */
    update(setpoint, measurement, now = Date.now()) {
        const error = setpoint - measurement;

       
        if (this.previousTime === null) {
            this.previousTime = now;
            this.previousError = error;
            return this.clamp(this.kp * error);
        }

        const dt = (now - this.previousTime) / 1000; 
        if (dt <= 0) return this.clamp(this.kp * error);

        this.integral += error * dt;

        const derivative = (error - this.previousError) / dt;

        const output = this.kp * error + this.ki * this.integral + this.kd * derivative;

        const clamped = this.clamp(output);
        if (output !== clamped) {
            this.integral -= error * dt;
        }

        this.previousError = error;
        this.previousTime = now;
        return clamped;
    }

    clamp(value) {
        return Math.min(Math.max(value, this.outputMin), this.outputMax);
    }

    reset() {
        this.integral = 0;
        this.previousError = 0;
        this.previousTime = null;
    }
}