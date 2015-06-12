// jQuel 0.1 by Staffan Hellman
// http://github.com/puddi/jQuel

(function(window) {

	var jQuel = function(fileData) {
		this.data = [];
		this.jp = null;
		var obj = {};
		if (typeof(fileData) == 'string') {
			obj.file = fileData;
			obj.type = fileData.split(".")[fileData.split(".").length - 1];
		} else if (typeof(fileData) == 'object') {
			obj = fileData;
		}
		
		this.p = $.ajax({
			url: obj.file,
			type: 'GET',		
			timeout: 10000
		}).then(function(d) {
			if (obj.type == 'csv') {
				this.parseCSV(d);				
			} else if (obj.type == 'tsv') {
				this.parseTSV(d);
			}
			return this;
		}.bind(this));

		return this;
	}

	var formatter = function(delimiter, d) {
		var t = [];
		for (var i = 0; i < d.length; i++) {
			var k = Object.keys(d[i]);
			for (var j = 0; j < k.length; j++) {
				if (t.indexOf(k[j]) == -1) {
					t.push(k[j]);
				}
			}
		}
		var s = "";
		s += t.join(delimiter) + "\n";
		for (var i = 0; i < d.length; i++) {
			for (var j = 0; j < t.length; j++) {
				s += d[i][t[j]];
				if (j + 1 != t.length) {
					s += delimiter;
				}
			}
			s += "\n";
		}
		return s;
	}

	var parser = function(delimiter, d, ref) {
		rows = d.split("\n");
		columns = rows[0].split(delimiter);
		for (var i = 1; i < rows.length; i++) {
			var obj = {};
			var entries = rows[i].split(delimiter);
			for (var j = 0; j < columns.length; j++) {
				obj["" + columns[j]] = entries[j];
			}
			ref.push(obj);
		}
	}

	var defaultJoin = function(a, b) {
		var ak = Object.keys(a);
		var bk = Object.keys(b);
		var common = $.grep(ak, function(e) {
			return $.inArray(e, bk) != -1;
		});
		if (common.length == 0) {
			return false;
		}
		for (var i = 0; i < common.length; i++) {
			if (a[common[i]] != b[common[i]]) {
				return false;
			}
		}
		return true;
	}

	var sideJoin = function(a, b, joinOn) {
		var result = [];
		for (var i = 0; i < a.data.length; i++) {
			var temp = [];
			for (var j = 0; j < b.data.length; j++) {
				if (joinOn(a.data[i], b.data[j])) {
					result.push($.extend(true, {}, b.data[j], a.data[i]));
				}
			}
			if (temp.length = 0) {
				var d = $.extend(true, {}, a.data[i]);
				for (var k = 0; k < Object.keys(b.data[0]).length; k++) {
					if (d[Object.keys(b.data[0])[k]] == undefined) {
						d[Object.keys(b.data[0])[k]] = null;
					}
				}
			}
		}
		this.data = result;
	}

	jQuel.prototype = {
		parseTSV: function(d) {
			parser("\t", d, this.data);
			return this;
		},

		parseCSV: function(d) {
			parser(",", d, this.data);
			return this;
		},

		join: function(fileData, joinOn) {
			var g = this;
			if (typeof(joinOn) != "function") {
				joinOn = defaultJoin;
			}
			var j, r;
			this.p = this.p.then(function(d) {
				r = new jQuel(fileData);
				return r.p;
			}).then(function(d) {
				var result = [];
				for (var i = 0; i < g.data.length; i++) {
					for (var j = 0; j < r.data.length; j++) {
						if (joinOn(g.data[i], r.data[j])) {
							result.push($.extend(true, {}, r.data[j], g.data[i]));
						}
					}
				}
				g.data = result;
			});

			return this;
		},

		leftJoin: function(fileData, joinOn) {
			var g = this;
			if (typeof(joinOn) != "function") {
				joinOn = defaultJoin;
			}
			var j, r;
			this.p = this.p.then(function(d) {
				r = new jQuel(fileData);
				return r.p;
			}).then(function(d) {
				sideJoin(g, r, joinOn);
			});
		},

		rightJoin: function(fileData, joinOn) {
			var g = this;
			if (typeof(joinOn) != "function") {
				joinOn = defaultJoin;
			}
			var j, r;
			this.p = this.p.then(function(d) {
				r = new jQuel(fileData);
				return r.p;
			}).then(function(d) {
				sideJoin(r, g, joinOn);
			});
		},

		sort: function(sortBy) {
			var g = this;
			function sortHelper() {
				g.data.sort(sortBy);
			}
			this.p = this.p.then(sortHelper);
			return this;
		},

		fill: function(obj, all) {
			var g = this;
			function fillHelper() {
				var k = Object.keys(obj);
				for (var i = 0; i < g.data.length; i++) {
					for (var j = 0; j < k.length; j++) {
						var cur = k[j];
						if (all || !g.data[i][cur]) {
							if (typeof(obj[cur]) == "function") {
								g.data[i][cur] = obj[cur](g.data[i]);
							} else {
								g.data[i][cur] = obj[cur];
							}
						}
					}
				}
			}
			this.p = this.p.then(fillHelper);
			return this;
		},

		add: function(obj) {
			var g = this;
			function addHelper() {
				var k = Object.keys(obj);
				for (var i = 0; i < k.length; i++) {
					if (typeof(obj[k[i]]) == "function") {
						obj[k[i]] = obj[k[i]]();
					}
				}
				g.data.push(obj);
			}
			this.p = this.p.then(addHelper);
			return this;
		},

		filter: function(filterBy) {
			var g = this;
			function filterHelper() {
				var result = [];
				for (var i = 0; i < g.data.length; i++) {
					if (filterBy(g.data[i])) {
						result.push(g.data[i]);
					}
				}
				g.data = result;
			}

			this.p = this.p.then(filterHelper);
			return this;
		},

		delete: function(arr) {
			var g = this;
			if (typeof(arr) != 'object') {
				var r = [];
				r.push(arr);
				arr = r;
			}
			function deleteHelper() {
				for (var i = 0; i < g.data.length; i++) {
					var d = g.data[i];
					for (var j = 0; j < arr.length; j++) {
						delete d["" + arr[j]];
					}
				}
			}

			this.p = this.p.then(deleteHelper);
			return this;
		},

		select: function(arr) {
			var g = this;
			if (typeof(arr) != 'object') {
				var r = [];
				r.push(arr);
				arr = r;
			}
			function selectHelper() {
				var result = [];
				for (var i = 0; i < g.data.length; i++) {
					var obj = {};
					for (var j = 0; j < arr.length; j++) {
						obj[arr[j]] = g.data[i][arr[j]];
					}
					result.push(obj);
				}
				g.data = result;
			}

			this.p = this.p.then(selectHelper);
			return this;
		},

		getJSON: function() {
			return this.p.then(function(d) {
				return JSON.stringify(this.data);
			}.bind(this));
		},

		getCSV: function() {
			return this.p.then(function(d) {
				return formatter(",", this.data);
			}.bind(this));
		},

		getTSV: function() {
			return this.p.then(function(d) {
				return formatter("\t", this.data);
			}.bind(this));
		}
	}

	window.jQuel = jQuel;
})(window);
