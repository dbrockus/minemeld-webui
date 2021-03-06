/// <reference path="../../../typings/main.d.ts" />

import { IMinemeldStatusService } from  '../../app/services/status';

export interface INodeDetailResolverService {
    registerClass(classname: string, classdetails: INodeDetailClass);
    resolveNode(nodename: string);
}

export interface INodeDetailTab {
    icon: string;
    tooltip: string;
    state: string;
    active: boolean;
}

export interface INodeDetailClass {
    tabs: INodeDetailTab[];
}

export class NodeDetailResolver implements INodeDetailResolverService {
    mmstatus: IMinemeldStatusService;
    $resource: angular.resource.IResourceService;

    nodeClasses: any = {};

    defaultClass: INodeDetailClass = {
        tabs: [
            {
                icon: 'fa fa-circle-o',
                tooltip: 'INFO',
                state: 'nodedetail.info',
                active: false
            },
            {
                icon: 'fa fa-area-chart',
                tooltip: 'STATS',
                state: 'nodedetail.stats',
                active: false
            },
            {
                icon: 'fa fa-asterisk',
                tooltip: 'GRAPH',
                state: 'nodedetail.graph',
                active: false
            }
        ]
    };

    /** @ngInject */
    constructor(MinemeldStatusService: IMinemeldStatusService, $resource: angular.resource.IResourceService) {
        this.mmstatus = MinemeldStatusService;
        this.$resource = $resource;
    }

    registerClass(classname: string, classdetails: INodeDetailClass) {
        this.nodeClasses[classname] = classdetails;
    }

    resolveNode(nodename: string) {
        return this.mmstatus.getMinemeld()
        .then((result: any) => {
            var node: any;

            node = result.filter((x: any) => { return x.name === nodename; })[0];

            if (this.nodeClasses.hasOwnProperty(node.class)) {
                return this.nodeClasses[node.class];
            }

            return this.defaultClass;
        });
    }
}
