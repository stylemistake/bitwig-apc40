function inRange( value, a, b ) {
	return ( value >= a ) && ( value <= b );
}

function setTimeout( fun, time, args ) {
	if ( args === undefined ) args = [];
	host.scheduleTask( fun, args, time );
}

function isNote( status ) {
	return inRange( status, 0x80, 0x9f );
}

function isNoteOn( status ) {
	return inRange( status, 0x90, 0x9f );
}

function isNoteOff( status ) {
	return inRange( status, 0x80, 0x8f );
}

function isControl( status ) {
	return inRange( status, 0xb0, 0xbf );
}

function toRelative( data2 ) {
	return ( data2 < 0x40 ? data2 : data2 - 0x80 );
}

function timestamp() {
	return (new Date()).getTime();
}