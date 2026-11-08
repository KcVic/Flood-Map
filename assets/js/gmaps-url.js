(function (global) {
    var NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';
    var TYPED_PAIR = new RegExp('^' + NUM + '\\s*,\\s*' + NUM + '$');       // "9.0765, 7.3986"
    var URL_PAIR = new RegExp('^(?:loc:)?\\s*' + NUM + '\\s*(?:,|\\s|\\+)\\s*' + NUM + '$', 'i'); // also "9.0765 7.3986", "loc:9.07+7.39"
    var PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;                   // marker of a selected place, in the data= blob
    var VIEWPORT = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/; // map centre (and zoom) the link was shared at

    function toCoords(lat, lng) {
        lat = parseFloat(lat);
        lng = parseFloat(lng);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        return { lat: lat, lng: lng };
    }

    function matchPair(regex, value) {
        var m = value ? regex.exec(value.trim()) : null;
        return m ? toCoords(m[1], m[2]) : null;
    }

    function decode(segment) {
        var text = segment.replace(/\+/g, ' ');
        try { text = decodeURIComponent(text); } catch (e) { /* leave malformed escapes as they are */ }
        return text.trim();
    }

    function coordsResult(coords, zoom, label) {
        return { kind: 'coords', lat: coords.lat, lng: coords.lng, zoom: zoom || 16, label: label || '' };
    }

    function parseUrl(text) {
        var raw = text;
        if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;

        var url;
        try { url = new URL(raw); } catch (e) { return { kind: 'unsupported' }; }

        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        var path = url.pathname;

        if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && /^\/maps/.test(path))) {
            return { kind: 'shortlink' };
        }
        var isGoogleMaps = /^maps\.google\.[a-z.]+$/.test(host) ||
            (/^google\.[a-z.]+$/.test(host) && /^\/maps(\/|$)/.test(path));
        if (!isGoogleMaps) return { kind: 'unsupported' };

        var params = url.searchParams;
        var segments = path.split('/').filter(Boolean);   // e.g. ["maps", "place", "Jabi+Lake+Mall", "@9.07,7.42,17z", "data=..."]
        var section = segments[1] || '';
        var viewport = VIEWPORT.exec(path);
        var zoom = viewport && viewport[3] ? Math.round(parseFloat(viewport[3])) : null;

        // The name Google shows for the place, if the link has one
        var named = '';
        if (section === 'place' || section === 'search') {
            named = segments[2] && segments[2].charAt(0) !== '@' ? decode(segments[2]) : '';
        } else if (section === 'dir') {
            // /maps/dir/<origin>/<destination>/@...: the destination is the last plain segment
            var stops = segments.slice(2).filter(function (s) { return s.charAt(0) !== '@' && s.indexOf('data=') !== 0; });
            named = stops.length ? decode(stops[stops.length - 1]) : '';
        }
        var paramText = params.get('q') || params.get('query') || params.get('destination') || params.get('daddr') || '';

        var pinMatch = PIN.exec(path);
        var pin = pinMatch && toCoords(pinMatch[1], pinMatch[2]);
        if (pin) return coordsResult(pin, zoom || 17, named);

        var direct = matchPair(URL_PAIR, paramText) || matchPair(URL_PAIR, params.get('ll')) ||
            matchPair(URL_PAIR, params.get('center')) || matchPair(URL_PAIR, named);
        if (direct) return coordsResult(direct, zoom || 17, '');

        if (section === 'dir' && (named || paramText)) {
            var dest = paramText || named;
            return { kind: 'query', query: dest, label: dest };
        }

        if (viewport) {
            var centre = toCoords(viewport[1], viewport[2]);
            if (centre) return coordsResult(centre, zoom, named);
        }

        if (paramText || named) {
            var query = paramText || named;
            return { kind: 'query', query: query, label: query };
        }

        return { kind: 'unsupported' };
    }

    function parseSearchInput(input) {
        var text = (input || '').trim();
        if (!text) return null;

        var typed = matchPair(TYPED_PAIR, text);
        if (typed) return coordsResult(typed, 17, '');

        var looksLikeUrl = /^https?:\/\//i.test(text) ||
            /^(www\.)?(maps\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl\/|goo\.gl\/maps)/i.test(text);
        return looksLikeUrl ? parseUrl(text) : null;
    }

    global.parseSearchInput = parseSearchInput;
    if (typeof module !== 'undefined' && module.exports) module.exports = { parseSearchInput: parseSearchInput };
})(typeof window !== 'undefined' ? window : this);
