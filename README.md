## APC40 mapping script for Bitwig Studio

This is a custom mapping script for Akai APC40 performance
controller to control Bitwig Studio.

***

### Status

As of February 25, 2014, it's on early development stage. Currently, this
is the only available Akai APC40 control script for Bitwig Studio. :)

Some of the features are more or less done:

* Modeswitching (currently using mode 2)
* User mapping of all knobs
* User mapping of crossfader (with two virtual controls for A and B tracks)
* Knob LED feedback from Bitwig Studio
* Automatic mapping of faders to track/master volume
* BPM changing with "cue" knob while pressing "shift" button
* Clip/scene launching and virtual view scrolling
* Transport buttons (play/stop/rec)

What does not work (aka missing major features / working on):

* Clip launcher LED feedback
* Current position indicator of clip launcher in Bitwig Studio
* Track mute/solo/arm buttons
* Track selectors, device and track control banks

Script was only tested with Linux version of Bitwig Studio, so testers from
other platforms are welcome.

***

### Known bugs

See [issues](https://github.com/stylemistake/bitwig_apc40/issues).

***

### Installation

Place all repository tree into `Bitwig Studio/Controller Scripts` folder,
restart Bitwig Studio and check settings.

***

### Contacts

Email: stylemistake@gmail.com
Web: [stylemistake.com](http://stylemistake.com)