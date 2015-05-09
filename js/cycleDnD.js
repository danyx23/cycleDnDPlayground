import Cycle from 'cyclejs';
import cuid from 'cuid';
const {h, Rx} = Cycle;

function intent(interactions) {
    return {
        dragOver$: interactions.get('.project-bin', 'dragover')
                               .map(eventData => {
                                    eventData.preventDefault();
                                    return eventData.dataTransfer.files;
                                }),
        droppedFiles$: interactions.get('.project-bin', 'drop')
                                  .map(eventData => {
                                        eventData.preventDefault();
                                        return eventData.dataTransfer.files;
                                    })
    };
};

function model(intent) {
    return {
        isDragHovering$: intent.dragOver$.map(_ => true)
                                         .takeUntil(intent.droppedFile$)
                                         .concat(Rx.Observable.just(false)),
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
                                        return asset;
                                    })
                                    .scan(new Map(), (itemMap, item) => itemMap.set(item.id, item))
    }
}

function view(model) {
    return Rx.Observable.combineLatest(model.isDragHovering$,
                                       model.items$,
        (isDraghovering, items) => {
            const vItems = items.values().map(item => {
                return h('div.project-item', {key: item.id}, [
                    h('img.project-item__image'),
                    h('div.project-item__name', item.name)
                ]);
            });

           return h('div.project-bin', {attributes: {class: isDraghovering ? 'project-bin--hovering' : ''}}, [
               h('div.project-bin__items', vItems)
           ]);
        });
}

function app(interactions){
    return view(model(intent(interactions)));
}

Cycle.applyToDOM('.js-container', app);