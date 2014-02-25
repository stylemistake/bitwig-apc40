load("dispatcher.js");

function APC40( midi_in, midi_out ) {

	var self = this;


	// -------------------------------------------------------------------
	//  Initialization
	// -------------------------------------------------------------------

	var config = {};

	var state = {
		mode: 0,
		device_knobs: [],
		track_knobs: [],
		crossfader: 0,
		is_shifted: false,
	};

	var page = {};

	var dispatcher = new Dispatcher( midi_out, 100 );

	function __init__() {
		midi_in.setMidiCallback( onMidi );
		midi_in.setSysexCallback( onSysex );
		self.clear().mode(2);
		return self;
	}



	// -------------------------------------------------------------------
	//  Events and callbacks
	// -------------------------------------------------------------------

	var event_callbacks = {};

	function fireEvent( name, _args ) {
		if ( event_callbacks[ name ] !== undefined ) {
			var args = [].slice.call( arguments );
			args.shift();
			for ( i in event_callbacks[ name ] ) {
				event_callbacks[ name ][i].apply( this, args );
			}
		}
	}

	this.setEventCallback = function( name, callback ) {
		if ( event_callbacks[ name ] === undefined ) event_callbacks[ name ] = [];
		event_callbacks[ name ].push( callback );
	}



	// -------------------------------------------------------------------
	//  Private methods
	// -------------------------------------------------------------------

	function onMidi( status, data1, data2 ) {
		// Shift event
		if ( isNote( status ) && data1 === 0x62 ) {
			state.is_shifted = ( status === 0x90 );
			return fireEvent( "shift_press", state.is_shifted );
		}
		// Device knob change
		if ( isControl( status ) && inRange( data1, 0x10, 0x17 ) ) {
			var knob = self.setDeviceKnob( data1 - 0x10, data2, undefined, true );
			return fireEvent( "device_knob_change", knob );
		}
		// Track knob change
		if ( isControl( status ) && inRange( data1, 0x30, 0x37 ) ) {
			var knob = self.setTrackKnob( data1 - 0x30, data2, undefined, true );
			return fireEvent( "track_knob_change", knob );
		}
		// Crossfader change ( a/b mode )
		if ( isControl( status ) && data1 === 0x0f ) {
			var crossfader = {
				"a": ( data2 <= 64 ? 127 : 254 - data2 * 2 ),
				"b": ( data2 >= 64 ? 127 : data2 * 2 ),
				"value": data2
			};
			if ( data2 > state.crossfader ) crossfader.assign_a = true;
			else crossfader.assign_b = true;
			state.crossfader = data2;
			return fireEvent( "crossfader_change", crossfader );
		}
		// Cue knob change (+bpm)
		if ( isControl( status ) && data1 === 0x2f ) {
			if ( state.is_shifted ) return fireEvent( "bpm_change", toRelative( data2 ) );
			return fireEvent( "cue_level_change", toRelative( data2 ) );
		}
		// Track volume change
		if ( isControl( status ) && data1 === 0x07 ) {
			return fireEvent( "track_volume_change", {
				"track": status & 0x0f,
				"value": data2
			});
		}
		// Master volume change
		if ( isControl( status ) && data1 === 0x0e ) {
			return fireEvent( "master_volume_change", data2 );
		}
		// Scroll event
		if ( isNoteOn( status ) && inRange( data1, 0x5e, 0x61 ) ) {
			// enum: up, down, right, left
			return fireEvent( "scroll_button_press", data1 - 0x5e );
		}
		// Clip launch/stop event
		if ( isNoteOn( status ) && inRange( data1, 0x34, 0x39 ) ) {
			return fireEvent( "clip_launcher_press", {
				"scope": "clip",
				"action": ( data1 === 0x34 ? "stop" : "launch" ),
				"x": status & 0x0f,
				"y": data1 - 0x35,
			});
		}
		// Scene launch/stop event
		if ( isNoteOn( status ) && inRange( data1, 0x51, 0x56 ) ) {
			return fireEvent( "clip_launcher_press", {
				"scope": "scene",
				"action": ( data1 === 0x51 ? "stop" : "launch" ),
				"y": data1 - 0x52,
			});
		}
		// Transport event
		if ( isNoteOn( status ) && inRange( data1, 0x5b, 0x5d ) ) {
			// enum: play, stop, rec
			return fireEvent( "transport_button_press", data1 - 0x5b );
		}

		printMidi( status, data1, data2 );
		return fireEvent( "unhandled_midi_message", {
			"status": status,
			"data1": data1,
			"data2": data2
		});
	}

	function onSysex( data ) {
		printSysex( data );
	}



	// -------------------------------------------------------------------
	//  Public methods
	// -------------------------------------------------------------------

	// Set controller mode
	this.mode = function( mode ) {
		if ( mode === undefined ) return state.mode;
		state.mode = mode;
		sendSysex("F0 47 01 73 60 00 04 4" + mode + " 00 00 00 F7");
		return self;
	};

	// self.led = function( ch, i, s ) {
	// 	var c = 0x80 + ch + ( s === 0 ? 0 : 0x10 );
	// 	sendMidi( c, i, s );
	// 	printMidi( c, i, s );
	// 	return self;
	// }

	// self.drawBitwigLogo = function() {
	// 	for ( var x = 2; x <= 5; x++ ) self.led( x, 0x36, 5 );
	// 	for ( var x = 1; x <= 6; x++ ) self.led( x, 0x37, 5 );
	// 	self.led( 1, 0x38, 5 ); self.led( 2, 0x38, 5 );
	// 	self.led( 5, 0x38, 5 ); self.led( 6, 0x38, 5 );
	// 	return self;
	// }

	this.clear = function() {
		for ( var i = 0; i < 8; i += 1 ) self.setDeviceKnob( i, 0, 0 );
		for ( var i = 0; i < 8; i += 1 ) self.setTrackKnob( i, 0, 0 );
		return self;
	}

	this.setDeviceKnob = function( id, value, type, no_queue ) {
		var knob = state.device_knobs[ id ] || { id: id };
		if ( type === undefined ) type = knob.type;
		if ( no_queue === true ) {
			if ( knob.type !== type ) dispatcher.send( 0xB0, 0x18 + id, type );
			dispatcher.send( 0xB0, 0x10 + id, value );
		} else {
			if ( knob.type !== type ) dispatcher.add( 0xB0, 0x18 + id, type );
			dispatcher.add( 0xB0, 0x10 + id, value );
		}
		knob.delta = value - knob.value;
		knob.type = type; knob.value = value;
		return state.device_knobs[ id ] = knob;
	}

	this.setTrackKnob = function( id, value, type, no_queue ) {
		var knob = state.track_knobs[ id ] || { id: id };
		if ( type === undefined ) type = knob.type;
		if ( no_queue === true ) {
			if ( knob.type !== type ) dispatcher.send( 0xB0, 0x38 + id, type );
			dispatcher.send( 0xB0, 0x30 + id, value );
		} else {
			if ( knob.type !== type ) dispatcher.add( 0xB0, 0x38 + id, type );
			dispatcher.add( 0xB0, 0x30 + id, value );
		}
		knob.delta = value - knob.value;
		knob.type = type; knob.value = value;
		return state.track_knobs[ id ] = knob;
	}


	__init__();
}