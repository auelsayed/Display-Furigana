function createRubyTags(kanji, hiragana) {
    ruby = document.createElement("ruby");
    ruby.innerHTML = kanji;
    rp_open = document.createElement("rp")
    rp_open.innerHTML = "("
    rp_close = document.createElement("rp")
    rp_close.innerHTML = ")"
    rt = document.createElement("rt");
    rt.setAttribute("style", "font-size : 60%; color : black;")
    rt.innerHTML = hiragana;
    ruby.append(rp_open);
    ruby.append(rt);
    ruby.append(rp_close);
    return ruby
}

// Deferred, getTokenizer, and tokenize credited to kuromojin.js
// https://github.com/azu/kuromojin
class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

var _tokenizer;

var deferred = new Deferred()

var isLoading = false;

function getTokenizer() {
    if (_tokenizer) {
        return Promise.resolve(_tokenizer);
    }
    if (isLoading) {
        return deferred.promise;
    }
    isLoading = true;
    // load dict
    kuromoji.builder({
        dicPath: chrome.extension.getURL("dict/")
    }).build(function (err, tokenizer) {
        if (err) {
            return deferred.reject(err);
        }
        _tokenizer = tokenizer;
        deferred.resolve(tokenizer);
    });
    return deferred.promise;
}

async function tokenize(text) {
    try {
        const tokenizer = await getTokenizer();
        return tokenizer.tokenize(text);
    } catch (e) {
        console.log(e);
    }
}

function arrayEqual(arrayA, arrayB) {
    return (arrayA.length == arrayB.length) && arrayA.every(function (element, index) {
        return element === arrayB[index];
    });
}

(async () => {

    var elements = document.getElementsByTagName('*');

    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];

        for (var j = 0; j < element.childNodes.length; j++) {
            var node = element.childNodes[j];

            if (node.nodeType === 3) {
                var t = node.parentElement.tagName;
                // Remove script, css, and already available furigana texts
                if (t === 'SCRIPT' || t === 'STYLE' || t === 'RUBY' || t === 'RP' || t === 'RT' || t === "RB")
                    continue;
                // Skip empty text
                if (node.nodeValue.trim() === "") {
                    continue;
                }

                var text = node.nodeValue;

                var words = await tokenize(text);
                let temp_dom = document.createDocumentFragment()

                for (let i = 0; i < words.length; i++) {
                    const word = words[i];
                    original_word = word["surface_form"]

                    // Kanji parts of the page are split up to find the appropiate
                    // hiragana to place inside ruby tags
                    if (Kuroshiro.Util.isKanji(original_word) && word["word_type"] == "KNOWN") {
                        original_split = original_word.split('')

                        // Convert the katakana to hiragana
                        hiragana_form = Kuroshiro.Util.kanaToHiragna(word["reading"])
                        hiragana_split = hiragana_form.split('')

                        // Get only the hiragana to the kanji to display as furigana
                        // i.e. avoid writing okurigana as furigana as well
                        furigana = hiragana_split.filter(x => !original_split.includes(x)).join('');

                        // In the case that there is no okurigana
                        if (arrayEqual(original_split, furigana)) {
                            furigana = hiragana_form;
                        }

                        // Create the ruby tags with the appropaite furigana
                        ruby = createRubyTags(original_word, furigana)

                        // Add to the temporary DOM to mass replace 
                        // original DOM when complete
                        temp_dom.appendChild(ruby)

                    } else {
                        // Non-kanji parts of the page
                        new_text = document.createTextNode(original_word)
                        temp_dom.appendChild(new_text)
                    }
                }

                // Replace original DOM with new one that includes furigana
                element.replaceChild(temp_dom, node)

            }
        }
    }
})()