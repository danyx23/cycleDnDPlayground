import Cycle from 'cyclejs';
const {h, Rx} = Cycle;
import cuid from 'cuid';
import Immutable from 'immutable';
import Rxdom from 'rx-dom';

const projectItemDataType = "dragged-item-id";

function projectItemComponent(drivers) {
    const dragStart$ = drivers.DOM.get('.project-item', 'dragstart')
                                  .withLatestFrom(drivers.props.get('asset'), (dragEventData, asset) => { return {dragEventData, key: asset.id}})
                                  .tap(eventDataAndKey => eventDataAndKey.dragEventData.dataTransfer.setData(projectItemDataType, eventDataAndKey.key))
                                  .select(eventDataAndKey => eventDataAndKey.key)
                                  .tap(key => console.log("drag started with element" + key));
    const asset$ = drivers.props.get('asset');
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
                              h('img.project-item__image', {src: data})
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
                              h('div.project-item__progress', {style: {width: (progress * 100), color: "black"}})
                            ];
                          }
                        }
                        return h('div.project-item', content);
                      });

    return {
        DOM: vtree$,
        events: {
          dragStart: dragStart$
        }
    };
}

function timelineComponent(drivers) {
    const projectItems$ = drivers.props.get('projectItems');

    const timelineDragEnter$ = drivers.DOM.get('.timeline', 'dragenter')
        .map(eventData => {
            eventData.stopPropagation();
            eventData.preventDefault();
            return eventData.dataTransfer.getData(projectItemDataType);
        })
        .filter(idString => idString);

    const clips$ = timelineDragEnter$
                         .scan(Immutable.List(), (list, item) => list.push(item))
                         .startWith(Immutable.List());

    const vtree$ = Rx.Observable
                    .combineLatest(projectItems$, clips$, (projectItems, clips) =>
                                    {
                                        let clipCounter = 0;
                                        clipsDom = clips.map(item => h('div.timeline-clip', {key: clipCounter++}, [h('img.timeline-clip-image', {src: projectItems.get(item)})])).toArray();
                                        return h('div.timeline', clipsDom);
                                    });

    return {
        DOM: vtree$
    };
}

function intent(drivers) {
    const projectBinDragEnter$ = drivers.DOM.get('.project-bin', 'dragenter')
        .map(eventData => {
            eventData.stopPropagation();
            eventData.preventDefault();
            return eventData;
        });
    const projectBinDragEnterFiles$ = projectBinDragEnter$
        //.filter(eventData => eventData.dataTransfer.files.length > 0)
        .map(eventData => {
            eventData.dataTransfer.dropEffect = 'copy';
            return eventData.dataTransfer.files;
        });

    const projectBinDragLeave$ = drivers.DOM.get('.project-bin', 'dragleave')
        .map(_ => true);

    const projectBinDragOver$ = drivers.DOM.get('.project-bin', 'dragover')
        .map(eventData => {
            eventData.stopPropagation();
            eventData.preventDefault();
            return eventData;
        });
    const projectBinDragOverFiles$ = projectBinDragOver$
        .filter(eventData => eventData.dataTransfer.files.length > 0)
        .map(eventData => {
            eventData.dataTransfer.dropEffect = 'copy';
            return eventData.dataTransfer.files;
        });

    const projectBinDropped$ = drivers.DOM.get('.project-bin', 'drop')
        .map(eventData => {
            eventData.stopPropagation();
            eventData.preventDefault();
            return eventData;
        })
        .share();
    const projectBinDroppedFiles$ = projectBinDropped$
        .filter(eventData => eventData.dataTransfer.files.length > 0)
        .map(eventData => eventData.dataTransfer.files);
    return {
        projectBinDragEnterFiles$,
        projectBinDragOverFiles$,
        projectBinDragLeave$,
        projectBinDroppedFiles$
    };
}

function model(intent) {
    const projectItems$ = intent.projectBinDroppedFiles$
        .flatMap(files => {
            const filesArray = [];
            for (let i = 0; i < files.length; i++) {
                filesArray.push(files[i]);
            }
            return Rx.Observable.from(filesArray);
            })
        .map(file => {
            const progressRaw$ = new Rx.Subject();
            const data$ = Rxdom.DOM.fromReader(file, progressRaw$).asDataURL();
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
        });
    return {
        isDragHovering$: intent.projectBinDragOverFiles$
                             .merge(intent.projectBinDragEnterFiles$)
                             .map(_ => true)
                             .merge(intent.projectBinDroppedFiles$.map(_ => false))
                             .merge(intent.projectBinDragLeave$.map(_ => false))
                             .startWith(false),
        items$: projectItems$
                    .scan(Immutable.Map(), (map, item) => map.merge({[item.id]: item}))
                    .tap(map => console.log(map))
                    .startWith(Immutable.Map())
    }
}

function view(model) {
    return Rx.Observable.combineLatest(model.isDragHovering$,
                                       model.items$,
        (isDraghovering, items) => {
            let vItems;
            if (items.size === 0)
                vItems = h('div', 'drop files here');
            else
                vItems = items.map((item) => h('project-item.project-item', {key: item.id, asset: item}, [])).toArray();

           return h('div.slideshow', [
               h('div', {attributes: {class: isDraghovering ? 'project-bin--hovering project-bin' : 'project-bin'}}, [
                h('div.project-bin__items', vItems)
               ])/*,
               h('timeline.timeline', {key: 1})*/
               ]);
        });
}

function app(drivers){
  const vtree$ = view(model(intent(drivers)));
  return {
    DOM: vtree$
  };
}

Cycle.run(app, {
  DOM: Cycle.makeDOMDriver('.js-container', {
    'project-item': projectItemComponent,
    'timeline': timelineComponent
  })
});
