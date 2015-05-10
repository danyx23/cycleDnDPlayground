import Cycle from 'cyclejs';
import cuid from 'cuid';
const {h, Rx} = Cycle;
import R from 'ramda';

Cycle.registerCustomElement('project-item', function (interactions, props) {
    var asset = props.get('asset');
    var vtree$ = Rx.Observable.combineLatest(asset.progress$, asset.loadedImage$, asset.error$, function (progress, loadedImage, error) {
        let content;

        if (loadedImage !== null) {
            content = [
                h('img.project-item__image', {src: loadedImage}),
                h('div.project-item__name', asset.name)
            ];
        }
        else if (error !== null) {
            content = [
                h('div', 'error')
            ];
        }
        else {
            content = [
                h('div.project-item__progress', {style: {width: (progress * 100)}})
            ];
        }

        return h('div.project-item', {key: asset.id}, content);
    });

    return {
        vtree$: vtree$
    };
});

function intent(interactions) {
    return {
        dragEnter$: interactions.get('.project-bin', 'dragenter')
                            .map(eventData => {
                                eventData.stopPropagation();
                                eventData.preventDefault();
                                eventData.dataTransfer.dropEffect = 'copy';
                                return eventData.dataTransfer.files;
                            }),
        dragOver$: interactions.get('.project-bin', 'dragover')
                           .map(eventData => {
                                eventData.stopPropagation();
                                eventData.preventDefault();
                                eventData.dataTransfer.dropEffect = 'copy';
                                return eventData.dataTransfer.files;
                            }),
        droppedFiles$: interactions.get('.project-bin', 'drop')
                          .map(eventData => {
                                eventData.stopPropagation();
                                eventData.preventDefault();
                                return eventData.dataTransfer.files;
                            })
                           .share()
    };
};

function arrayUpdateHelper(itemArray, item) {
    const arrayCopy = itemArray.slice();
    arrayCopy.push(item);
    return arrayCopy;
}

function model(intent) {
    const projectItems$ = intent.droppedFiles$.flatMap(files => {
        const filesArray = [];
        for (var i = 0; i < files.length; i++) {
            filesArray.push(files[i]);
        }
        return Rx.Observable.from(filesArray);
        })
        .map(file => {
            const fileReader = new FileReader();
            const asset = {
                id: cuid(),
                name: file.name,
                progress$: Rx.Observable.fromEvent(fileReader.onprogress)
                                        .map(e => {
                                                if (e.lengthComputable)
                                                    return (evt.loaded / evt.total);
                                                else
                                                    return 0;
                                            })
                                        .startWith(0),
                loadedImage$: Rx.Observable.fromEvent(fileReader.onload)
                                        .map(e => e.target.result)
                                        .startWith(null),
                error$: Rx.Observable.fromEvent(fileReader.onerror)
                                        .map(e => e.target.error)
                                        .startWith(null)
            };
            fileReader.readAsDataURL(file);
            console.log(`id: ${asset.id}, name: ${asset.name}`);
            return asset;
        })
        .share();
    return {
        isDragHovering$: intent.dragOver$
                             .merge(intent.dragEnter$)
                             .map(_ => true)
                             .merge(intent.droppedFiles$.map(_ => false))
                             .startWith(false),
        items$: projectItems$
                    .scan([], arrayUpdateHelper)
                    .startWith([]),
        itemChanges$: projectItem$.flatMap(item =>
                        Rx.Observable.merge(item.progress$, item.fileLoad$, item.fileError$).debounce(200))
    }
}

function view(model) {
    return Rx.Observable.combineLatest(model.isDragHovering$,
                                       model.items$,
        (isDraghovering, items) => {
            let vItems;
            if (items.length === 0)
                vItems = h('div', 'drop files here');
            else
                vItems = items.map(item => h('project-item', {asset: item}));

           return h('div', {attributes: {class: isDraghovering ? 'project-bin--hovering project-bin' : 'project-bin'}}, [
               h('div.project-bin__items', [vItems])
           ]);
        });
}

function app(interactions){
    return view(model(intent(interactions)));
}

Cycle.applyToDOM('.js-container', app);
