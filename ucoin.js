class Utils {
    static qualityValue(quality) {
        if (quality == "UNC") return 10;
        if (quality == "XF")  return 8;
        if (quality == "VF")  return 7;
        if (quality == "F")   return 6;
        if (quality == "VG")  return 5;
        if (quality == "G")   return 4;
        return 0;
    };
}

class Logger {

    static log(text = "") {
        const logArea = document.getElementsByClassName("ucoin-log")[0];
        if (logArea) {
            logArea.textContent = text;
        } else {
            try {
                document.getElementsByClassName("bottom-lang-container")[0].firstChild.firstChild.children[18].insertAdjacentHTML("afterend", `<li><span class="ucoin-log" style="color:gray">${text}</span></li>`);
            } catch(error) {
                console.log(text);
            }
        }
    }

}

class UCoin {
    static Me() {
        const uid = document.getElementsByClassName("menu gray-13")[1].attributes.href.value.match(/uid(\d+)/)[1];
        const me = UCoin.load("-me-");
        if (me.uid == uid) {
            return me;
        } else {
            return new UCoin(uid, "-me-");
        }
    }

    static Other() {
        const uid = document.getElementsByClassName("user-info")[0].children[1].href.split("/uid")[1];
        const name = document.getElementsByClassName("user-info")[0].children[1].title;
        return new UCoin(uid, name);
    }

    static load(name) {
        var json = localStorage.getItem(name);
        var obj = new UCoin();
        Object.assign(obj, JSON.parse(json))
        return obj;
    }

    constructor(uid, name) {
        this.uid = uid;
        this.name = name;
        this.catalog = [];
        this.swapList = [];
        this.swapClosed = [];
        this.swapInProgress = [];
        this.countries = [];
        this.periods = [];
    }

    save() {
        if (this.name) {
            localStorage.setItem(this.name, JSON.stringify(this));
        }
    }

    update() {
        return Promise.all([
            this.readCatalog(),
            this.readSwapList(),
            this.readSwapInfo(),
            this.readCountries(),
            this.readPeriods(),
        ]);
    }

    // Scrap data
    //
    readPeriods() {
        const self = this;
        const url = `https://es.ucoin.net/gallery/?uid=${self.uid}`;

        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: url,
                success: function (response) {
                    self.periods = [];
                    Logger.log(`Reading Periods`);

                    const doc = new DOMParser().parseFromString(response, 'text/xml');
                    const regions = doc.getElementsByClassName('reg');
                    for (var i = 0; i < regions.length; i++) {
                        const region = regions[i];
                        const countries = region.getElementsByClassName('country');
                        for (var j = 0; j < countries.length; j++) {
                            const country = countries[j];
                            const countryCode = country.attributes["data-code"].value;
                            const countryName = country.getElementsByClassName("country-name")[0].attributes.title.value;
                            const periods = country.getElementsByClassName('period');
                            for (var k = 0; k < periods.length; k++) {
                                const period = periods[k];
                                self.periods.push({
                                    country_code: countryCode,
                                    country_name: countryName,
                                    period_id: period.attributes.pid.value,
                                    period_name: period.attributes.title.value,
                                    period_interval: period.lastChild.textContent,
                                });
                            };
                        };
                    };

                    self.save();
                    Logger.log();
                    resolve();
                },
                error: function (error) {
                    Logger.log(`Error: ${error}`);
                    reject(error);
                },
            });
        });
    }

    readCatalog(page = 1) {
        const self = this;
        const url = `https://es.ucoin.net/gallery/?uid=${self.uid}&page=${page}`;

        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: url,
                success: function (response) {
                    if (page === 1) {
                        self.catalog = [];
                    }
                    Logger.log(`Reading Catalog page #${page}`);

                    var doc = new DOMParser().parseFromString(response, 'text/xml');
                    var rows = doc.getElementsByClassName('coin');

                    if (rows.length > 0) {
                        const _getTextContent = function (element, className, index) {
                            var node = element.getElementsByClassName(className)[index];
                            return node ? node.textContent : '';
                        };

                        for (var i = 0; i < rows.length; i++) {
                            const row = rows.item(i);
                            var coin = {
                                country: _getTextContent(row, 'blue-15', 0).split(/,? /)[0],
                                denomination: _getTextContent(row, 'blue-15', 0).split(/,? /)[1],
                                year: _getTextContent(row, 'blue-15', 0).split(/,? /)[2],
                                composition: _getTextContent(row, 'desc', 0).split(/,? /)[0],
                                weight: _getTextContent(row, 'desc', 0).split(/,? /)[1],
                                diameter: _getTextContent(row, 'desc', 0).split(/,? /)[2],
                                coinType: _getTextContent(row, 'gray-11', 1).split(' · ')[0],
                                catalogNumber: _getTextContent(row, 'gray-11', 1).split(' · ')[1],
                                subject: _getTextContent(row, 'dgray-13', 0),
                                mintmark: _getTextContent(row, 'gray-13', 0),
                                price: parseFloat(_getTextContent(row, 'blue-12 right', 0).split('$ ')[1]) || 0.0
                            };
                            self.catalog.push(coin);
                        }
                        self.readCatalog(page + 1)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        self.save();
                        Logger.log();
                        resolve();
                    }
                },
                error: function (error) {
                    Logger.log(`Error: ${error}`);
                    reject(error);
                },
            });
        });
    }

    readSwapList(page = 1) {
        const ownerUid = document.getElementsByClassName("menu gray-13")[1].attributes.href.value.match(/uid(\d+)/)[1];
        const self = this;
        const url = `https://es.ucoin.net/swap-list/?uid=${self.uid}&v=need-by-type&order=ka&page=${page}`;
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: url,
                success: function (response) {
                    if (page == 1) {
                        self.swapList = [];
                    }
                    Logger.log(`Reading SwapList page #${page}`);
                    var doc = new DOMParser().parseFromString(response, "text/xml");
                    var rows = (self.uid == ownerUid) ? doc.getElementsByClassName("edit-checkbox") : doc.getElementsByClassName("swap-checkbox");
                    if (rows.length > 0) {
                        for (var i= 0; i < rows.length; i++) {
                            const row = rows.item(i).parentElement.parentElement;
                            var coin = {
                                id:             row.attributes.id.value.match(/usid(\d+)/)[1],
                                country:        row.attributes["data-tooltip-name"].value.split(` ${row.children[2].textContent}`)[0],
                                denomination:   row.children[2].textContent,
                                year:           row.children[1].textContent,
                                catalogNumber:  row.children[7].textContent,
                                subject:        row.children[3].textContent,
                                quality:        row.children[4].textContent,
                                price:          parseFloat(row.children[5].textContent.split("$ ")[1]) || 0.0,
                                priceColor:     row.children[5].children[1].style.color,
                            }
                            self.swapList.push(coin);
                        };
                        self.readSwapList(page + 1)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        self.save();
                        Logger.log();
                        resolve(self.swapList);
                    }
                },
                error: function (error) {
                    Logger.log(`Error : ${error}`);
                    reject(error);
                },
            });
        });
    }

    readSwapEvent(sid, userId, userName, swapStatus) {
        const self = this;
        if (self.swapClosed.includes(sid)) {
            return;
        }

        const url = `https://es.ucoin.net/swap-mgr/?sid=${sid}`;
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: url,
                success: function (response) {
                    Logger.log(`Reading SwapEvent #${sid}`);
                    var doc = new DOMParser().parseFromString(response, "text/xml");
                    var swapStatus = doc.getElementsByClassName("user-info")[1].nextSibling.children[1].textContent;
                    var swapClosed = ["Éxito","Neutro","Fallido"].includes(swapStatus);
                    if (swapClosed) {
                        self.swapClosed.push(sid);
                    }
                    var rows = doc.getElementById("need-swap-list").getElementsByClassName("swap-checkbox");
                    if (!swapClosed && rows.length > 0) {
                        for (var i= 0; i < rows.length; i++) {
                            const row = rows.item(i).parentElement.parentElement;
                            var swap = {
                                offerId:        row.attributes["data-soid"].value,
                                swapId:         sid,
                                swapStatus:     swapStatus,
                                userId:         userId,
                                userName:       userName,
                                coinId:         row.children[3].firstChild.attributes.href.value.split("cid=")[1],
                                country:        row.attributes["data-tooltip-name"].value.split(` ${row.children[3].textContent}`)[0],
                                denomination:   row.children[3].textContent,
                                year:           row.children[2].textContent,
                                catalogNumber:  row.children[8].textContent,
                                subject:        row.children[4].textContent,
                                quality:        row.children[5].textContent,
                                price:          parseFloat(row.children[6].textContent.split("$ ")[1]) || 0.0
                            }
                            self.swapInProgress.push(swap);
                        };
                    } else {
                        Logger.log();
                    }
                    resolve();
                },
                error: function (error) {
                    Logger.log(`Error : ${error}`);
                    reject(error);
                },
            });
        });
    }

    readSwapInfo(page = 1) {
        const self = this;
        const url = `https://es.ucoin.net/swap-mgr/?v=all&page=${page}`;
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: url,
                success: function (response) {
                    if (page == 1) {
                        self.swapInProgress = [];
                    }
                    Logger.log(`Reading SwapMgr page #${page}`);
                    var doc = new DOMParser().parseFromString(response, "text/xml");
                    var rows = doc.getElementsByClassName("str");
                    if (rows.length > 0) {
                        for (var i= 0; i < rows.length; i++) {
                            const row = rows.item(i);
                            var swap = {
                                id:             row.attributes["data-href"].value.split("=")[1],
                                userId:         row.children[0].firstChild.href.split("/uid")[1],
                                userName:       row.children[1].textContent,
                                status:         row.children[2].textContent,
                                count:          parseInt(row.children[3].textContent),
                            }
                            if (swap.count > 0 && !["Rechazar"].includes(swap.status)) {
                                self.readSwapEvent(swap.id, swap.userId, swap.userName, swap.status);
                            }
                        };
                        self.readSwapInfo(page + 1)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        self.save();
                        Logger.log();
                        resolve();
                    }
                },
                error: function (error) {
                    Logger.log(`Error : ${error}`);
                    reject(error);
                },
            });
        });
    }

    readCountries() {
        const self = this;
        const url = `https://es.ucoin.net/gallery/?uid=${self.uid}&view=country`;
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: url,
                success: function (response) {
                    Logger.log(`Reading Countries`);
                    const doc = new DOMParser().parseFromString(response, "text/xml");
                    const rows = doc.getElementsByClassName("cntry");
                    self.countries = [];
                    for (var i= 0; i < rows.length; i++) {
                        self.countries.push(rows.item(i).title);
                    };
                    self.save();
                    resolve();
                },
                error: function (error) {
                    Logger.log(`Error : ${error}`);
                    reject(error);
                },
            });
        });
    }

    readExchange(url, page = 1, userList = []) {
        const extractRows = (rows, list) => {
            for (var i= 0; i < rows.length; i++) {
                const row = rows.item(i).parentElement;
                var userInfo = {
                    needed: parseInt(row.children[3].firstChild.textContent),
                    row:    row,
                }
                list.push(userInfo);
            };
        };

        const preapareList = (list) => {
            return list
                .filter(r => r.needed > 0)
                .sort((a,b) => b.needed - a.needed)
                .map(a => a.row)
        };

        const self = this;
        return new Promise((resolve, reject) => {
            if (url) {
                $.ajax({
                    type: 'GET',
                    url: `${url}&page=${page}`,
                    success: function (response) {
                        Logger.log(`Reading Exchange page #${page}`);
                        var doc = new DOMParser().parseFromString(response, "text/xml");
                        var rows = doc.getElementsByClassName("user-avatar");
                        if (rows.length > 0) {
                            extractRows(rows, userList);
                            self.readExchange(url, page + 1, userList)
                                .then(resolve)
                                .reject();
                        } else {
                            Logger.log();
                            resolve(preapareList(userList));
                        }
                    },
                    error: function (error) {
                        Logger.log(`Error : ${error}`);
                        reject(error);
                    },
                });
            } else {
                var rows = document.getElementsByClassName("user-avatar");
                extractRows(rows, userList);
                resolve(preapareList(userList));
            }
        });
    }

    // Powered pages
    //
    touchMySwapsPage() {
        var rows = document.getElementsByClassName("str");
        for (var i= 0; i < rows.length; i++) {
            const row = rows.item(i);
            const action = row.getElementsByClassName("list-act").item(0);
            if (row.children[2].textContent == '' && action) {
                action.href = action.href.replace('archive', 'delete');
                action.onclick = '';
            }
        }
    }

    touchDownloads() {
        if (me.periods.length > 0) {
            const exportBlock = document.getElementsByClassName("export-block")[0];

            const catalogLink = exportBlock.childNodes[1];
            catalogLink.textContent = "Catalogo de Monedas (XLS)"

            const content = Object.keys(me.periods[0]).join(",") + "\n" +
                    me.periods.map(period => Object.values(period).map(t => t.replace("\n", "")).join(",")).join("\n");

            const periodsLink = exportBlock.childNodes[0];
            periodsLink.textContent = "Paises/Periodos (CSV)";
            periodsLink.download = "UCoin - Periodos.csv"
            periodsLink.href = 'data:text/csv;charset=utf-8,%EF%BB%BF'+encodeURIComponent(content);
        }
    }

    touchSwapUsersPage() {
        const iNeedColumn = document.getElementsByClassName("list-header")[0].firstChild.firstChild.children[2];
        iNeedColumn.innerHTML = '<a href="javascript:this.me.showListByNeeded()" class="gray-12">I need</a>';

        const swapGuruLink = document.getElementById("tree").firstChild;
        swapGuruLink.onclick = (event) => { eval('filter = {'+document.getElementById("filter").value+'}'); SwapGuru.doSwapOffers(filter); }
        swapGuruLink.innerHTML = '<span class="gray-12">** Swap Guru **</a>';
        swapGuruLink.insertAdjacentHTML("afterEnd", '<div><textarea id="filter" style="font-size:8px;min-height:10px;width:80%;"></textarea></div>');
    }

    touchCoinPage() {
        const infoBlock = document.getElementsByClassName("coin-info")[0];
        const kmBlock = infoBlock.children[0].children[0].children[1];
        const country = kmBlock.firstChild.href.split("-")[0].split("/")[4];
        const kmValue = kmBlock.innerText.split(".")[0].replace("#", "%23").replace(" ", "+");
        let year = null;
        infoBlock.children[0].childNodes.forEach(node => {
            if (node.children[0].innerText == "Año") {
                year = node.children[1].innerText;
            }
        });
        infoBlock.previousSibling.innerHTML = `<a href="https://es.numista.com/catalogue/index.php?e=${country}&r=${year}+${kmValue}&ct=coin&tb=y&tc=y&tn=y&tp=y&tt=y&cat=y&ca=3">Información:</a>`
    }

    showListByNeeded() {
        const table = document.getElementsByClassName("user")[0];
        if (table?.firstChild?.children?.length > 0) {
            const pages = document.getElementsByClassName("pages")[0];
            const url = pages?.firstChild?.href;

            if (pages) {
                table.innerHTML = '<tbody>reading & sorting ...</tbody>';
                pages.innerHTML = '';
            }

            this.readExchange(url)
                .then(rows => {
                    table.innerHTML = `<tbody>${rows.map(r => r.outerHTML).join("")}</tbody>`;
                    const header = document.getElementsByClassName("list-header")[0].firstChild.firstChild;
                    for (var i= 0; i < header.children.length; i++) {
                        header.children[i].firstChild?.removeAttribute("style");
                    }
                    header.children[2].innerHTML = '<td style="width:60px;"><span class="gray-12" style="font-weight: bold;">I need</span></td>'
                });
        }
    }

    checkSwapEvent() {
        const self = this;
        const user = UCoin.Other();
        var rows = document.getElementsByClassName("swap-checkbox");
        if (rows.length > 0) {
            for (var i= 0; i < rows.length; i++) {
                const row = rows.item(i).parentElement.parentElement;
                var coin = {
                    country:        row.attributes["data-tooltip-name"].value.split(` ${row.children[3].textContent}`)[0],
                    catalogNumber:  row.attributes["data-tooltip-km"]?.value,
                    quality:        row.children[5].textContent,
                    price:          parseFloat(row.children[6].textContent.split("$ ")[1]) || 0.0
                }

                const inSwap = self.swapInProgress.find(c => {
                    return c.country==coin.country && c.catalogNumber==coin.catalogNumber && c.userId != user.uid;
                });

                if (inSwap) {
                    row.style.background = "lightgrey";
                    if (coin.price > inSwap.price || Utils.qualityValue(coin.quality) < Utils.qualityValue(inSwap.quality)) {
                        row.style.background = "lightsalmon";
                    }
                    row.children[7].innerHTML = `<a href="/swap-mgr/?sid=${inSwap.swapId}" target="_blank" style="display: inline-block;"><div class="ico-16" style="background-position: 0 -33px;" title="Swap with: ${inSwap.userName}"></div></a>`;
                }
            };
        }
    }

    checkSwapPage() {
        const self = this;
        var rows = document.getElementsByClassName("swap-checkbox");
        if (rows.length > 0) {
            const swapUserId = UCoin.Other().uid;
            for (var i= 0; i < rows.length; i++) {
                const row = rows.item(i).parentElement.parentElement;
                var coin = {
                    id:             row.attributes.id.value,
                    country:        row.attributes["data-tooltip-name"].value.split(` ${row.children[2].textContent}`)[0],
                    denomination:   row.children[2].textContent,
                    year:           row.children[1].textContent,
                    catalogNumber:  row.children[7].textContent,
                    subject:        row.children[3].textContent,
                    quality:        row.children[4].textContent,
                    price:          parseFloat(row.children[5].textContent.split("$ ")[1]) || 0.0,
                    checked:        row.children[0].firstChild.checked,
                }

                const inSwap = self.swapInProgress.find(c => {
                    return c.country==coin.country && c.catalogNumber==coin.catalogNumber && (!coin.checked || c.userId != swapUserId);
                });

                if (inSwap) {
                    row.style.background = "lightgrey";
                    row.children[8].innerHTML = `<a href="/swap-mgr/?sid=${inSwap.swapId}" target="_blank" style="display: inline-block;"><div class="ico-16" style="background-position: 0 -33px;" title="Swap with: ${inSwap.userName}"></div></a>`;
                }
            };
        }
    }

    checkMyWishPage() {
        const self = this;
        var rows = document.getElementsByClassName("my");
        if (rows.length > 0) {
            for (var i= 0; i < rows.length; i++) {
                const row = rows.item(i);
                var coin = {
                    country:        row.attributes["data-tooltip-name"].value.split(` ${row.children[2].textContent}`)[0],
                    denomination:   row.children[2].textContent,
                    year:           row.children[1].textContent,
                    catalogNumber:  row.children[7].textContent,
                    subject:        row.children[3].textContent,
                }

                const inSwap = self.swapInProgress.find(c => {
                    return c.country==coin.country && c.catalogNumber==coin.catalogNumber}
                );

                if (inSwap) {
                    row.style.background = "lightgrey";
                    row.children[6].style.textAlign = "center";
                    row.children[6].innerHTML = `<a href="/swap-mgr/?sid=${inSwap.swapId}" target="_blank" style="display: inline-block;"><div class="ico-16" style="background-position: 0 -33px;" title="Swap with: ${inSwap.userName}"></div></a>`;
                }
            };
        }
    }

    checkYourWishPage() {
        const self = this;
        var rows = document.getElementsByClassName("td-cond");
        if (rows.length > 0) {
            for (var i= 0; i < rows.length; i++) {
                const row = rows.item(i).parentElement;
                var coin = {
                    country:        row.attributes["data-tooltip-name"].value.split(` ${row.children[1].textContent}`)[0],
                    denomination:   row.children[1].textContent,
                    year:           row.children[0].textContent,
                    catalogNumber:  row.children[5].textContent,
                    subject:        row.children[2].textContent,
                }

                const inSwap = self.swapList.find(c => {
                    return c.country==coin.country && c.catalogNumber==coin.catalogNumber}
                );

                if (inSwap) {
                    row.style.background = "lightgreen";

                } else {
                    const inCatalog = self.catalog.find(c => {
                        return c.country==coin.country && c.catalogNumber==coin.catalogNumber}
                    );

                    if (inCatalog) {
                        row.style.background = "lightyellow"; // lemonchiffon // antiquewhite
                    }
                }
            };
        }
    }

    checkTablePage() {
        const country = document.title.split(" (")[0];
        const idsInSwap = me.swapInProgress.filter(c => c.country == country).map(c => c.catalogNumber);
        if (idsInSwap.length > 0) {
            const cells = document.getElementsByClassName("cell marked-0");
            for (var i= 0; i < cells.length; i++) {
                const cell = cells[i];
                if (idsInSwap.includes(cell.id)) {
                    cell.style.background = "#999999";
                }
            };
        }
    }

    checkSwapInfoChange() {
        const self = this;
        var counter = 0;
        const swapList = document.getElementsByClassName("offer-list")[0].children[0].childNodes;
        for (var i = 0; i < swapList.length; i++) {
            const row = swapList[i];
            counter = counter + (parseInt(row.children[3].innerText) || 0);
        }
        if (self.swapsIncomming != counter) {
            self.swapsIncomming = counter;
            self.save();
            return true;
        } else {
            return false;
        }
    }
}

class SwapGuru {

    static addSwapOffer(userId, coinId) {
        $.ajax({
            type: 'GET',
            url: `https://es.ucoin.net/swap-list/?swap-offer=add&amp;uid=${userId}&amp;usid=${coinId}`,
            success: function (response) {
                Logger.log(`Add swap offer: uid:${userId}  usid:${coinId}`);
            },
            error: function (error) {
                Logger.log(`Error : ${error}`)
            },
        });
    }

    static removeSwapOffer(swapId, offerId) {
        $.ajax({
            type: 'GET',
            url: `https://es.ucoin.net/swap-mgr/?sid=${swapId}&f=d&soid=${offerId}`,
            success: function (response) {
                Logger.log(`Remove swap offer: uid:${userId}  soid:${offerId}`);
            },
            error: function (error) {
                Logger.log(`Error : ${error}`)
            },
        });
    }

    static doUserSwapOffer(uid, filter = {}) {
        return new Promise((resolve, reject) => {

            const evaluate = (candidate, selected) => {
                // Apply filter
                if (Utils.qualityValue(candidate.quality) < Utils.qualityValue(filter.minQuality))
                    return false;
                if (filter.excludeRedPrice && candidate.priceColor == "brown")
                    return false;
                if (candidate.price > filter.maxPrice)
                    return false;
                if (filter.countries?.length > 0 && !filter.countries.includes(candidate.country))
                    return false;
                if (filter.excludeCountries?.length > 0 && filter.excludeCountries.includes(candidate.country))
                    return false;
                if (filter.users?.length > 0 && !filter.users.includes(uid))
                    return false;
                if (filter.excludeUsers?.length > 0 && filter.excludeUsers.includes(uid))
                    return false;

                // Evaluate Quality
                if (selected && Utils.qualityValue(candidate.quality) < Utils.qualityValue(selected.quality))
                    return false;

                // Evaluate Price
                if (selected && candidate.price >= selected.price && Utils.qualityValue(candidate.quality) == Utils.qualityValue(selected.quality))
                    return false;

                return true;
            };

            const user = new UCoin(uid);
            user.readSwapList()
                .then(swapList => {
                    var swapOffer = {};
                    swapList.forEach(candidate => {
                        var key = `${candidate.country}-${candidate.catalogNumber}`;
                        var selected = swapOffer[key];
                        if (evaluate(candidate, selected)) {
                            swapOffer[key] = candidate;
                        }
                    });

                    const offers = Object.values(swapOffer).map(offer => {
                        return SwapGuru.addSwapOffer(uid, offer.id);
                    });
                    Promise.all(offers)
                        .then(resolve)
                        .catch(reject);
            });
        });
    }

    static removeDuplicateSwapOffer(me) {
        return new Promise((resolve, reject) => {
            me.readSwapInfo()
                .then(() => {
                    const toKeepList = [];
                    const toRemoveList = [];
                    me.swapInProgress.forEach(offer => {
                        const keepIndex = toKeepList.findIndex(o => {
                            return o.country==offer.country && o.catalogNumber==offer.catalogNumber}
                        );
                        if (keepIndex < 0) {
                            toKeepList.push(offer);
                        } else if (offer.price >= toKeepList[keepIndex].price) {
                            toRemoveList.push(offer);
                        } else {
                            toRemoveList.push(toKeepList[keepIndex]);
                            toKeepList[keepIndex] = offer;
                        }
                    });

                    const offers = [];
                    toRemoveList.forEach(offer => {
                        if (offer.swapStatus == "") {
                            offers.push(SwapGuru.removeSwapOffer(offer.swapId, offer.offerId));
                        }
                    });

                    Promise.all(offers)
                        .then(resolve)
                        .catch(reject);
            });
        });
    }

    static doSwapOffers(filter = {}) {
        return new Promise((resolve, reject) => {
            const me = UCoin.Me();
            const users = [];
            if (filter.users?.length > 0) {
                users.push(...filter.users);
            } else {
                const rows = document.getElementsByClassName("user-avatar");
                for (var i= 0; i < rows.length; i++) {
                    var row = rows.item(i).parentElement;
                    var uid = row.children[0].firstChild.href.match(/uid(\d+)/)[1];
                    users.push(uid);
                }
            }
            const swaps = users
                .filter(uid => !(filter.excludeUsers?.length > 0 && filter.excludeUsers.includes(uid)))
                .map(uid => SwapGuru.doUserSwapOffer(uid, filter));
            Promise.all(swaps)
                .then(_ => {
                    SwapGuru.removeDuplicateSwapOffer(me)
                        .then(resolve)
                        .catch(reject);
                });
        });
    }
}

if (document.location.href.startsWith('https://es.ucoin.net/')) {
    String.prototype.originalToUpperCase = String.prototype.toUpperCase;
    String.prototype.toUpperCase = function () { return this.originalToUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };

    this.me = UCoin.Me();

    if (document.location.href.startsWith('https://es.ucoin.net/quote/')) {
        this.me.update();

    } else if (document.location.href.startsWith(`https://es.ucoin.net/uid${this.me.uid}`)) {
        this.me.readPeriods();
        this.me.touchDownloads();

    } else if (document.location.href.startsWith('https://es.ucoin.net/swap-mgr') && !document.location.href.match('sid=')) {
        if (this.me.checkSwapInfoChange()) {
            this.me.readSwapInfo();
        }
        this.me.touchMySwapsPage();

    } else if (document.location.href.startsWith('https://es.ucoin.net/swap-mgr/?sid=')) {
        this.me.checkSwapEvent();

    } else if (document.location.href.startsWith('https://es.ucoin.net/swap-list/?uid=') && !document.location.href.match(`uid=${this.me.uid}`)) {
        this.me.checkSwapPage();

    } else if (document.location.href.startsWith(`https://es.ucoin.net/wish-list/?uid=${this.me.uid}`)) {
        this.me.checkMyWishPage();

    } else if (document.location.href.startsWith('https://es.ucoin.net/wish-list/')) {
        this.me.checkYourWishPage();

    } else if (document.location.href.startsWith('https://es.ucoin.net/table/')) {
        this.me.checkTablePage();

    } else if (document.location.href.startsWith('https://es.ucoin.net/swaps/')) {
        this.me.touchSwapUsersPage();

    } else if (document.location.href.startsWith('https://es.ucoin.net/coin/')) {
        this.me.touchCoinPage();
    }
}
