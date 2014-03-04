function Dispatcher( midi_out, interval ) {

	var self = this;
	var queue = {};
	var is_running = true;
	var is_paused = false;

	if ( interval === undefined ) interval = 500;

	this.add = function( status, data1, data2 ) {
		var msg = { status: status, data1: data1, data2: data2 };
		var key = "m_" + status + "_" + data1;
		queue[ key ] = msg;
	};

	this.send = function( status, data1, data2 ) {
		if ( ! is_paused ) {
			var key = "m_" + status + "_" + data1;
			delete queue[key];
			midi_out.sendMidi( status, data1, data2 );
		} else {
			self.add( status, data1, data2 );
		}
	}

	this.flush = function() {
		for ( i in queue ) {
			midi_out.sendMidi( queue[i].status, queue[i].data1, queue[i].data2 );
			delete queue[i];
		}
	};

	this.pause = function() {
		is_paused = true;
	}

	this.resume = function() {
		is_paused = false;
		self.flush();
	}

	this.stop = function() {
		is_running = false;
	};

	(function loop() {
		if ( ! is_paused ) self.flush();
		if ( is_running ) host.scheduleTask( loop, [], interval );
	})();

}