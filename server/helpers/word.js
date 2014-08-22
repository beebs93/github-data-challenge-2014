'use strict';

var _ = require('lodash'),
	xRegExp = require('xregexp').XRegExp;

module.exports = {
	/**
	 * Flattens then strips out any unwanted characters from a string
	 * 
	 * @param  string sWord
	 * @return string
	 *
	 * @author Brad Beebe
	 */
	sanitize: function(sWord){
		if(!_.isString(sWord)){
			return '';
		}

		sWord = sWord
					.replace(/[\r\n\t]/gm, ' ');

		sWord = xRegExp
					.replace(sWord, xRegExp('/[^a-z0-9_#\-\+\s\p{L}]/', 'ig'), ' ');

		sWord = sWord
					.replace(/\\n/g, ' ')
					.replace(/_/g, ' ')
					.replace(/\s{2,}/g, ' ')
					.replace(/(<([^>]+)>)/ig, '')
					.trim();

		return sWord;
	},



	/**
	 * Determines if a string only has numbers
	 * 
	 * @param  string  sWord
	 * @return bool
	 *
	 * @author Brad Beebe
	 */
	hasOnlyNumbers: function(sWord){
		if(_.isNumber(sWord)){
			sWord = sWord.toString();
		}

		if(!_.isString(sWord)){
			return false;
		}

		return sWord.replace(/\d+/g, '').length === 0;
	},



	/**
	 * Normalizes an array of strings
	 * 
	 * @param  array aRawWords
	 * @return array
	 *
	 * @author Brad Beebe
	 */
	normalizeList: function(aRawWords){
		var _this = this,
			aWords;

		if(!_.isArray(aRawWords)){
			return [];
		}

		aWords = [];

		_.forEach(aRawWords, function(sWord){
			sWord = _this.sanitize(sWord).toLowerCase();

			if(!sWord.length){
				return true;
			}

			aWords = aWords.concat(sWord.split(' '));
		});

		aWords = _.filter(aWords, function(sWord){
			return sWord.length > 0 && !_this.hasOnlyNumbers(sWord);
		});

		return aWords;
	}
};