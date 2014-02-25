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

function isControl( status ) {
	return inRange( status, 0xb0, 0xbf );
}