load("dispatcher.js");
load("events.js");

function APC40( midi_in, midi_out ) {

	var self = this;


	// -------------------------------------------------------------------
	//  Initialization
	// -------------------------------------------------------------------

	var config = {
		"nudge_bpm_delta": 5
	};

	var state = {
		"mode": 0,
		"device_knobs": [],
		"track_knobs": [],
		"crossfader": 0,
		"is_shifted": false,
		"bpm_tap": {
			"bpm": [],
			"ts": [],
		}
	};

	var dispatcher = new Dispatcher( midi_out, 100 );
	var events = new Events();

	this.setEventCallback = events.setCallback;

	function __init__() {
		midi_in.setMidiCallback( onMidi );
		midi_in.setSysexCallback( onSysex );
		self.clear().mode(2);
		self.logoAnimation();
		return self;
	}

	this.stop = function() {
		dispatcher.stop();
		events.destroy();
		return self;
	}



	// -------------------------------------------------------------------
	//  MIDI handlers
	// -------------------------------------------------------------------

	function onMidi( status, data1, data2 ) {
		// Temporary Led press feedback
		if ( isNote( status ) && data1 === 0x34 ) {
			self.setClipLauncherLed({
				"scope": "clip", "x": status & 7, "y": data1 - 0x35,
				"value": isNoteOn( status ) ? 1 : 0
			});
		}
		if ( isNote( status ) && inRange( data1, 0x51, 0x56 ) ) {
			self.setClipLauncherLed({
				"scope": "scene", "y": data1 - 0x52,
				"value": isNoteOn( status ) ? 1 : 0
			});
		}

		// Shift event
		if ( isNote( status ) && data1 === 0x62 ) {
			state.is_shifted = ( status === 0x90 );
			return events.fire( "shift_press", state.is_shifted );
		}
		// Device knob change
		if ( isControl( status ) && inRange( data1, 0x10, 0x17 ) ) {
			var knob = self.setDeviceKnob( data1 - 0x10, data2, undefined, true );
			return events.fire( "device_knob_change", knob );
		}
		// Track knob change
		if ( isControl( status ) && inRange( data1, 0x30, 0x37 ) ) {
			var knob = self.setTrackKnob( data1 - 0x30, data2, undefined, true );
			return events.fire( "track_knob_change", knob );
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
			return events.fire( "crossfader_change", crossfader );
		}
		// Cue knob change (+bpm)
		if ( isControl( status ) && data1 === 0x2f ) {
			if ( state.is_shifted ) return events.fire( "bpm_change", toRelative( data2 ) );
			return events.fire( "cue_level_change", toRelative( data2 ) );
		}
		// Track volume change
		if ( isControl( status ) && data1 === 0x07 ) {
			return events.fire( "track_volume_change", status & 0x07, data2 );
		}
		// Track activators / solo/cue / arm
		if ( isNoteOn( status ) && data1 === 0x32 ) {
			return events.fire( "track_activator_press", status & 0x0f );
		}
		if ( isNoteOn( status ) && data1 === 0x31 ) {
			return events.fire( "track_solo_press", status & 0x0f );
		}
		if ( isNoteOn( status ) && data1 === 0x30 ) {
			return events.fire( "track_arm_press", status & 0x0f );
		}
		// Track selector
		if ( isNoteOn( status ) && data1 === 0x33 ) {
			return events.fire( "track_selection", status & 0x0f );
		}
		if ( isNoteOn( status ) && data1 === 0x50 ) {
			return events.fire( "track_selection", -1 );
		}
		// Master volume change
		if ( isControl( status ) && data1 === 0x0e ) {
			return events.fire( "master_volume_change", data2 );
		}
		// Scroll event
		if ( isNoteOn( status ) && inRange( data1, 0x5e, 0x61 ) ) {
			// enum: up, down, right, left
			return events.fire( "scroll_button_press", data1 - 0x5e );
		}
		// Clip launch/stop event
		if ( isNoteOn( status ) && inRange( data1, 0x34, 0x39 ) ) {
			return events.fire( "clip_launcher_press", {
				"scope": "clip",
				"action": ( data1 === 0x34 ? "stop" : "launch" ),
				"x": status & 0x0f,
				"y": data1 - 0x35,
			});
		}
		// Scene launch/stop event
		if ( isNoteOn( status ) && inRange( data1, 0x51, 0x56 ) ) {
			return events.fire( "clip_launcher_press", {
				"scope": "scene",
				"action": ( data1 === 0x51 ? "stop" : "launch" ),
				"y": data1 - 0x52,
			});
		}
		// Transport event
		if ( isNoteOn( status ) && inRange( data1, 0x5b, 0x5d ) ) {
			// enum: play, stop, rec
			return events.fire( "transport_button_press", data1 - 0x5b );
		}
		// Nudge button
		if ( isNote( status ) && inRange( data1, 0x64, 0x65 ) ) {
			var bpm_delta = ( 0x65 - data1 ) * config.nudge_bpm_delta*2 - config.nudge_bpm_delta;
			if ( isNoteOff( status ) ) bpm_delta = -bpm_delta;
			return events.fire( "bpm_change", bpm_delta );
		}
		// Tap BPM button
		if ( isNoteOff( status ) && data1 === 0x63 ) return false;
		if ( isNoteOn( status ) && data1 === 0x63 ) {
			var bpm = self.tapTempo();
			if ( bpm ) return events.fire( "bpm_tap", bpm );
			else return false;
		}
		// Other buttons
		if ( isNoteOn( status ) && data1 === 0x3a ) return events.fire( "clip_track_press" );
		if ( isNoteOn( status ) && data1 === 0x3b ) return events.fire( "device_on_off_press" );
		if ( isNoteOn( status ) && data1 === 0x3c ) return events.fire( "left_press" );
		if ( isNoteOn( status ) && data1 === 0x3d ) return events.fire( "right_press" );
		if ( isNoteOn( status ) && data1 === 0x3e ) return events.fire( "detail_press" );
		if ( isNoteOn( status ) && data1 === 0x3f ) return events.fire( "quantization_press" );
		if ( isNoteOn( status ) && data1 === 0x40 ) return events.fire( "overdub_press" );
		if ( isNoteOn( status ) && data1 === 0x41 ) return events.fire( "metronome_press" );

		printMidi( status, data1, data2 );
		return events.fire( "unhandled_midi_message", status, data1, data2 );
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
		midi_out.sendSysex("F0 47 01 73 60 00 04 4" + mode + " 00 00 00 F7");
		return self;
	}

	this.clear = function() {
		for ( var i = 0; i < 8; i += 1 ) self.setDeviceKnob( i, 0, 0 );
		for ( var i = 0; i < 8; i += 1 ) self.setTrackKnob( i, 0, 0 );
		for ( var x = 0; x < 8; x += 1 ) for ( var y = -5; y < 5; y += 1 ) {
			self.setClipLauncherLed({ "scope": "clip", "x": x, "y": y, "value": 0 });
		}
		for ( var i = 0x3a; i < 0x42; i += 1 ) self.setButtonLed( 0, i, false );
		return self;
	}

	this.logoAnimation = function( on_finished ) {
		dispatcher.pause();
		var logo = [
			[ 0, 0, 0, 0, 0, 0, 0, 0 ],
			[ 0, 0, 3, 3, 3, 3, 0, 0 ],
			[ 0, 3, 3, 3, 3, 3, 3, 0 ],
			[ 0, 3, 3, 0, 0, 3, 3, 0 ],
			[ 0, 0, 0, 0, 0, 0, 0, 0 ]
		];
		(function loop(i) {
			if ( i < 8 ) for ( var j = 0; j < 5; j += 1 ) {
				midi_out.sendMidi(
					( logo[j][i] === 0 ? 0x80 : 0x90 ) | i,
					0x35 + j, logo[j][i]
				);
			}
			if ( i < 8 ) setTimeout( loop, 75, [i+1] );
			else setTimeout( function() {
				dispatcher.resume();
				if ( on_finished !== undefined ) on_finished();
			}, 750 );
		})(0);
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

	this.setButtonLed = function( chan, note, status ) {
		if ( status === undefined ) status = 0;
		if ( typeof status === "boolean" ) status = status ? 1 : 0;
		dispatcher.send( ( status > 0 ? 0x90 : 0x80 ) | chan, note, status );
		return self;
	}

	this.setClipLauncherLed = function( data ) {
		if ( data.scope === "clip" ) self.setButtonLed( data.x, 0x35 + data.y, data.value );
		else self.setButtonLed( 0, 0x52 + data.y, data.value );
		return self;
	}

	this.setActivatorLed = function( id, value ) {
		return self.setButtonLed( id, 0x32, value );
	}

	this.setSoloLed = function( id, value ) {
		return self.setButtonLed( id, 0x31, value );
	}

	this.setArmLed = function( id, value ) {
		return self.setButtonLed( id, 0x30, value );
	}

	this.tapTempo = function() {
		var bpm, bpm_last, bpm_median, bpm_average = 0;
		var ts_now = timestamp();
		var ts_len = state.bpm_tap.ts.length;
		var ts_len_h = parseInt( ts_len/2 );
		var ts_last = state.bpm_tap.ts[ ts_len - 1 ];
		if ( ts_last === undefined || ts_now - ts_last > 1000 ) {
			state.bpm_tap.bpm = [];
			state.bpm_tap.ts = [ ts_now ];
			return false;
		} else {
			bpm = 60000 / ( ts_now - ts_last );
			state.bpm_tap.bpm.push( bpm );
			state.bpm_tap.ts.push( ts_now );
		}
		if ( ts_len > 5 ) {
			bpm_median = Math.round( state.bpm_tap.bpm.sort()[ ts_len_h - 1 ] );
			//bpm_average += state.bpm_tap.bpm[ ts_len_h - 2 ];
			bpm_average += state.bpm_tap.bpm[ ts_len_h - 1 ];
			bpm_average += state.bpm_tap.bpm[ ts_len_h - 0 ];
			bpm_average += state.bpm_tap.bpm[ ts_len_h + 1 ];
			bpm_average = Math.round( bpm_average / 3 );
			return Math.round(( bpm_median + bpm_average ) / 2);
		}
		return false;
	}


	__init__();
}