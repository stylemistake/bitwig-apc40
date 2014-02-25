loadAPI(1);

load("lib/helpers.js");
load("lib/apc40.js");


host.defineController(
	"stylemistake", "Akai APC40",
	"0.1", "0894C4A0-998E-11E3-A5E2-0800200C9A66"
);
host.defineMidiPorts( 1, 1 );
host.addDeviceNameBasedDiscoveryPair(
	["Akai APC40 MIDI 1"],
	["Akai APC40 MIDI 1"]
);

var controller, transport, userctl;

function init() {
	// Initialize
	controller = new APC40(
		host.getMidiInPort(0),
		host.getMidiOutPort(0)
	);

	transport = host.createTransport();
	userctl = host.createUserControlsSection( 64 );

	// -------------------------------------------------------------------
	//  Device knob user mapping
	// -------------------------------------------------------------------

	controller.setEventCallback( "device_knob_change", function( knob ) {
		userctl.getControl( knob.id ).inc( knob.delta, 128 );
	});

	for ( var i = 0; i < 8; i += 1 ) (function( id ) {
		mapUserCtl( userctl.getControl(i), "APC Knob D"+(i+1), function( value ) {
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
		mapUserCtl( userctl.getControl(i+8), "APC Knob T"+(i+1), function( value ) {
			controller.setTrackKnob( id, value, 1 );
		}, function() {
			controller.setTrackKnob( id, 0, 0 );
		});
	})(i);


	// -------------------------------------------------------------------
	//  Track knob user mapping
	// -------------------------------------------------------------------

	mapUserCtl( userctl.getControl( 16 ), "APC Crossfade A" );
	mapUserCtl( userctl.getControl( 17 ), "APC Crossfade B" );
	controller.setEventCallback( "crossfader_change", function( crossfader ) {
		println( "" + crossfader.a + " " + crossfader.b );
		if ( crossfader.assign_a ) {
			userctl.getControl( 16 ).set( crossfader.a, 128 );
			userctl.getControl( 17 ).set( crossfader.b, 128 );
		} else {
			userctl.getControl( 17 ).set( crossfader.b, 128 );
			userctl.getControl( 16 ).set( crossfader.a, 128 );
		}
	});


	host.showPopupNotification("APC40 plugged in");
}

function exit() {
	// TODO: Clean up mess after Bitwig
	host.showPopupNotification("APC40 plugged out");
	controller.mode(0);
}

function mapUserCtl( ctl, label, fun_on, fun_off ) {
	ctl.setLabel( label );
	ctl.setIndication( false );
	if ( fun_on !== undefined ) ctl.addValueObserver( 128, fun_on );
	if ( fun_off !== undefined ) ctl.addNameObserver( 2, "_u", function ( name ) {
		if ( name === "_u" ) fun_off();
	});
}