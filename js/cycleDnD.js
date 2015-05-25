import Cycle from 'cyclejs';
import cuid from 'cuid';
const {h, Rx} = Cycle;
import R from 'ramda';
import Rxdom from 'rx-dom';

Cycle.registerCustomElement('project-item', function (interactions, props) {
    const asset$ = props.get('asset');
    const vtree$ = asset$
                    .flatMap(asset => {
                      const progress$ = asset.progress$;
                      const data$ = asset.data$;
                      const progressPreprocessed$ = progress$.map(progress => {return {progress};});
                      const dataPreprocessed$ = data$.map(data => { return {data};})
                                                     .catch(Rx.Observable.just({err: "load failed"}));
                      return Rx.Observable.merge(progressPreprocessed$, dataPreprocessed$);
                    })
                    .map(op => {
                        let content;

                        if (op !== undefined) {
                          const {data, err, progress} = op;
                          if (data !== undefined) {
                            content = [
                              h('img.project-item__image', {src: data}),
                              //h('div.project-item__name', asset.name)
                            ];
                          }
                          else if (err !== undefined) {
                            content = [
                              h('div', 'error')
                            ];
                          }
                          else if (progress !== undefined) {
                            content = [
                              h('div.project-item__progress', {style: {width: (progress * 100)}})
                            ];
                          }
                        }
                        return h('div.project-item', content);
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
        for (let i = 0; i < files.length; i++) {
            filesArray.push(files[i]);
        }
        return Rx.Observable.from(filesArray);
        })
        .map(file => {
            const progressRaw$ = new Rx.Subject();
            const data$ = Rxdom.DOM.fromReader(file, progress$).asDataURL();
            const progress$ = progressRaw$.map(e => {
              if (e.lengthComputable)
                return e.loaded / e.total;
              else
                return 0;
            });
            const asset = {
                id: cuid(),
                name: file.name,
                progress$,
                data$
            };
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
                    .startWith([])
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
                vItems = items.map(item => h('project-item', {key: item.id, asset: item}));

           return h('div', {attributes: {class: isDraghovering ? 'project-bin--hovering project-bin' : 'project-bin'}}, [
               h('div.project-bin__items', [vItems])
           ]);
        });
}

function app(interactions){
    return view(model(intent(interactions)));
}

Cycle.applyToDOM('.js-container', app);
