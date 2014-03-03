loadAPI(1);

load("lib/polyfills.js");
load("lib/helpers.js");
load("lib/apc40.js");

host.defineController( "Akai", "APC40", "0.1", "0894C4A0-998E-11E3-A5E2-0800200C9A66" );
host.defineMidiPorts( 1, 1 );
host.addDeviceNameBasedDiscoveryPair( ["Akai APC40 MIDI 1"], ["Akai APC40 MIDI 1"] );
host.addDeviceNameBasedDiscoveryPair( ["Akai APC40"], ["Akai APC40"] );

var controller, transport, userctl, tracks, master, application;

function init() {
	// Initialize
	controller = new APC40(
		host.getMidiInPort(0),
		host.getMidiOutPort(0)
	);

	application = host.createApplication();
	transport = host.createTransport();
	master = host.createMasterTrack( 5 );
	tracks = host.createTrackBank( 8, 2, 5 );
	userctl = host.createUserControlsSection(64);

	// -------------------------------------------------------------------
	//  Device knob user mapping
	// -------------------------------------------------------------------

	controller.setEventCallback( "device_knob_change", function( knob ) {
		userctl.getControl( knob.id ).inc( knob.delta, 128 );
	});

	for ( var i = 0; i < 8; i += 1 ) (function( id ) {
		mapUserCtl( userctl.getControl(i), "Knob D"+(i+1), function( value ) {
			controller.setDeviceKnob( id, value, 1 );
		}, function() {
			controller.setDeviceKnob( id, 0, 0 );
		});
	})(i);


	// -------------------------------------------------------------------
	//  Track knob user mapping
	// -------------------------------------------------------------------

	controller.setEventCallback( "track_knob_change", function( knob ) {
		userctl.getControl( knob.id+8 ).inc( knob.delta, 128 );
	});

	for ( var i = 0; i < 8; i += 1 ) (function( id ) {
		mapUserCtl( userctl.getControl(i+8), "Knob T"+(i+1), function( value ) {
			controller.setTrackKnob( id, value, 1 );
		}, function() {
			controller.setTrackKnob( id, 0, 0 );
		});
	})(i);


	// -------------------------------------------------------------------
	//  Crossfade user mapping
	// -------------------------------------------------------------------

	mapUserCtl( userctl.getControl( 16 ), "Cross A" );
	mapUserCtl( userctl.getControl( 17 ), "Cross B" );
	controller.setEventCallback( "crossfader_change", function( crossfader ) {
		if ( crossfader.assign_a ) {
			userctl.getControl( 16 ).set( crossfader.a, 128 );
			userctl.getControl( 17 ).set( crossfader.b, 128 );
		} else {
			userctl.getControl( 17 ).set( crossfader.b, 128 );
			userctl.getControl( 16 ).set( crossfader.a, 128 );
		}
	});


	// -------------------------------------------------------------------
	//  Cue knob mappings
	// -------------------------------------------------------------------

	mapUserCtl( userctl.getControl( 18 ), "Knob Cue" );
	controller.setEventCallback( "cue_level_change", function( value ) {
		userctl.getControl( 18 ).inc( value, 128 );
	});

	controller.setEventCallback( "bpm_change", function( value ) {
		transport.increaseTempo( value, 647 );
	});


	// -------------------------------------------------------------------
	//  Track/Master volume mappings
	// -------------------------------------------------------------------

	controller.setEventCallback( "track_volume_change", function( track, value ) {
		// TODO: Master track volume must be modifiable only by master fader
		//       Also, they should not scroll together with clip view.
		tracks.getTrack( track ).getVolume().set( value, 188 );
	});

	controller.setEventCallback( "master_volume_change", function( value ) {
		master.getVolume().set( value, 188 );
	});


	// -------------------------------------------------------------------
	//  Track toggles
	// -------------------------------------------------------------------

	controller.setEventCallback( "track_activator_press", function( track ) {
		tracks.getTrack( track ).getMute().toggle();
	});

	for ( var i = 0; i < 8; i += 1 ) (function( i, track ) {
		track.getMute().addValueObserver( function( is_muted ) {
			controller.setActivatorLed( i, is_muted ? 0 : 1 );
		});
	})( i, tracks.getTrack(i) );

	controller.setEventCallback( "track_solo_press", function( track ) {
		tracks.getTrack( track ).getSolo().toggle();
	});

	for ( var i = 0; i < 8; i += 1 ) (function( i, track ) {
		track.getSolo().addValueObserver( function( is_solo ) {
			controller.setSoloLed( i, is_solo ? 1 : 0 );
		});
	})( i, tracks.getTrack(i) );

	controller.setEventCallback( "track_arm_press", function( track ) {
		tracks.getTrack( track ).getArm().toggle();
	});

	for ( var i = 0; i < 8; i += 1 ) (function( i, track ) {
		track.getArm().addValueObserver( function( is_armed ) {
			controller.setArmLed( i, is_armed ? 1 : 0 );
		});
	})( i, tracks.getTrack(i) );


	// -------------------------------------------------------------------
	//  Scrolling
	// -------------------------------------------------------------------

	controller.setEventCallback( "scroll_button_press", function( direction ) {
		if ( direction === 0 ) tracks.scrollScenesUp();
		else if ( direction === 1 ) tracks.scrollScenesDown();
		else if ( direction === 2 ) tracks.scrollTracksDown();
		else if ( direction === 3 ) tracks.scrollTracksUp();
	});


	// -------------------------------------------------------------------
	//  Clip launcher
	// -------------------------------------------------------------------

	controller.setEventCallback( "clip_launcher_press", function( data ) {
		if ( data.scope === "clip" ) {
			if ( data.action === "launch" ) {
				return tracks.getTrack( data.x ).getClipLauncherSlots().launch( data.y );
			} else {
				return tracks.getTrack( data.x ).getClipLauncherSlots().stop();
			}
		} else {
			if ( data.action === "launch" ) {
				return tracks.getClipLauncherScenes().launch( data.y );
			} else {
				return tracks.getClipLauncherScenes().stop();
			}
		}
	});

	for ( var i = 0; i < 8; i += 1 ) (function( i, slots ) {
		slots.setIndication( true );
		var states = [{},{},{},{},{},{},{},{}];
		var _led = function( slot, type, status ) {
			states[ slot ][ type ] = status;
			var state = states[ slot ];
			var result = { "scope": "clip", "x": i, "y": slot, "value": 0 };
			if ( state.content ) result.value = 5;
			if ( state.playing ) result.value = 1;
			if ( state.recording ) result.value = 3;
			if ( state.queued ) result.value = 2;
			controller.setClipLauncherLed( result );
		};
		slots.addHasContentObserver( function( slot, status ) {
			_led( slot, "content", status );
		});
		slots.addIsPlayingObserver( function( slot, status ) {
			_led( slot, "playing", status );
		});
		slots.addIsQueuedObserver( function( slot, status ) {
			_led( slot, "queued", status );
		});
		slots.addIsRecordingObserver( function( slot, status ) {
			_led( slot, "recording", status );
		});
	})( i, tracks.getTrack(i).getClipLauncherSlots() );

	// TODO: Make them scrollable
	// master.getClipLauncherSlots().addHasContentObserver( function( slot, has_content ) {
	// 	controller.setClipLauncherLed({
	// 		"scope": "scene",
	// 		"y": slot, "value": has_content ? 1 : 0
	// 	});
	// });


	// -------------------------------------------------------------------
	//  Transport mappings
	// -------------------------------------------------------------------

	controller.setEventCallback( "transport_button_press", function( value ) {
		if ( value === 0 ) return transport.restart();
		if ( value === 1 ) return transport.stop();
		if ( value === 2 ) return transport.record();
	});


	// -------------------------------------------------------------------
	//  Other mappings
	// -------------------------------------------------------------------

	controller.setEventCallback( "bpm_tap", function( value ) {
		transport.getTempo().set( value - 20, 647 );
	});


	// -----
	host.showPopupNotification("APC40 plugged in");
}

function exit() {
	// TODO: Clean up mess after Bitwig
	for ( var i = 0; i < 8; i += 1 ) (function( i, slots ) {
		slots.setIndication( false );
	})( i, tracks.getTrack(i).getClipLauncherSlots() );
	controller.mode(0).stop();
}

function mapUserCtl( ctl, label, fun_on, fun_off ) {
	ctl.setLabel( label );
	if ( fun_on !== undefined ) ctl.addValueObserver( 128, fun_on );
	if ( fun_off !== undefined ) ctl.addNameObserver( 2, "_u", function ( name ) {
		if ( name === "_u" ) fun_off();
	});
}
