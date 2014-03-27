function Events() {

	var self = this;

	var callbacks = {};

	this.fire = function( name, _args ) {
		if ( callbacks[ name ] !== undefined ) {
			var args = [].slice.call( arguments );
			args.shift();
			for ( i in callbacks[ name ] ) {
				callbacks[ name ][i].apply( this, args );
			}
		}
	}

	this.setCallback = function( name, callback ) {
		if ( callbacks[ name ] === undefined ) callbacks[ name ] = [];
		callbacks[ name ].push( callback );
	}

	this.destroy = function() {
		callbacks = {};
	}

}