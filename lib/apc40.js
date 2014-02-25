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
		// Device knob change
		if ( isControl( status ) && inRange( data1, 0x10, 0x17 ) ) {
			var knob = self.setDeviceKnob( data1 - 0x10, data2, undefined, true );
			fireEvent( "device_knob_change", knob );
		} else
		// Track knob change
		if ( isControl( status ) && inRange( data1, 0x30, 0x37 ) ) {
			var knob = self.setTrackKnob( data1 - 0x30, data2, undefined, true );
			fireEvent( "track_knob_change", knob );
		} else
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
			fireEvent( "crossfader_change", crossfader );
		} else
		// Shift event
		if ( isNote( status ) && data1 === 0x98 ) {
			state.is_shifted = ( status === 0x90 );
		} else
		if ( isControl( status ) && data1 === 0x2f ) {
			if ( state.is_shifted ) fireEvent( "bpm_change", data2 );
			else fireEvent( "cue_level_change", data2 );
		}


		else printMidi( status, data1, data2 );
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