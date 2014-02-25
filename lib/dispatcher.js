function Dispatcher( midi_out, interval ) {

	var self = this;
	var queue = {};
	var exiting = false;

	if ( interval === undefined ) interval = 500;

	this.add = function( status, data1, data2 ) {
		var msg = { status: status, data1: data1, data2: data2 };
		var key = "m_" + status + "_" + data1;
		queue[ key ] = msg;
	};

	this.send = function( status, data1, data2 ) {
		var key = "m_" + status + "_" + data1;
		delete queue[key];
		midi_out.sendMidi( status, data1, data2 );
		// println( "dispatcher: send: " + key + ": " + data2 );
	}

	this.flush = function() {
		for ( i in queue ) {
			midi_out.sendMidi( queue[i].status, queue[i].data1, queue[i].data2 );
			// println( "dispatcher: flush: " + i + ": " + queue[i].data2 );
			delete queue[i];
		}
	};

	this.stop = function() {
		exiting = true;
	};

	(function loop() {
		self.flush();
		if ( ! exiting ) host.scheduleTask( loop, [], interval );
	})();

}