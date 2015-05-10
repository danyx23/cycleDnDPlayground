import Cycle from 'cyclejs';
import cuid from 'cuid';
const {h, Rx} = Cycle;
import R from 'ramda';

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
    return {
        isDragHovering$: intent.dragOver$
                             .merge(intent.dragEnter$)
                             .map(_ => true)
                             .merge(intent.droppedFiles$.map(_ => false))
                             .startWith(false),
        items$: intent.droppedFiles$.flatMap(files => {
                        const filesArray = [];
                        for (var i = 0; i < files.length; i++) {
                            filesArray.push(files[i]);
                        }
                        return Rx.Observable.from(filesArray);
                    })
                    .map(file => {
                        const asset = {
                            id: cuid(),
                            name: file.name
                        };
                        console.log(`id: ${asset.id}, name: ${asset.name}`);
                        return asset;
                    })
                    .scan([], arrayUpdateHelper)
                    .startWith([])
    }
}

function view(model) {
    return Rx.Observable.combineLatest(model.isDragHovering$,
                                       model.items$,
        (isDraghovering, items) => {
            let vItems = items.map(item => {
                return h('div.project-item', {key: item.id}, [
                    h('img.project-item__image'),
                    h('div.project-item__name', item.name)
                ]);
            });

            if (items.length === 0)
                vItems = h('div', 'drop files here');

           return h('div', {attributes: {class: isDraghovering ? 'project-bin--hovering project-bin' : 'project-bin'}}, [
               h('div.project-bin__items', [vItems])
           ]);
        });
}

function app(interactions){
    return view(model(intent(interactions)));
}

Cycle.applyToDOM('.js-container', app);
