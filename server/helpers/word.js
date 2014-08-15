var _ = require('lodash'),
	XRegExp = require('xregexp').XRegExp;

module.exports = {
	/**
	 * Strips out any unsavory characters from a string
	 * 
	 * @param  string sWord
	 * @return string
	 *
	 * @author Brad Beebe
	 */
	_sanitize: function(sWord){
		if(!_.isString(sWord)){
			return '';
		}

		sWord = sWord
					.trim()
					.replace(/[\r\n\t]/gm, ' ');

		sWord = XRegExp
					.replace(sWord, XRegExp('/[^a-z0-9_#\-\+\s\p{L}]/', 'gi'), ' ');

		sWord = sWord
					.replace(/\\n/g, ' ')
					.replace(/_/g, ' ')
					.replace(/\s{2,}/g, ' ');

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
	_hasOnlyNumbers: function(sWord){
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
			sWord = _this._sanitize(sWord).toLowerCase();

			if(!sWord.length){
				return true;
			}

			aWords = aWords.concat(sWord.split(' '));
		});

		aWords = _.filter(aWords, function(sWord){
			return sWord.length > 0 && !_this._hasOnlyNumbers(sWord);
		});

		return aWords;
	}
};