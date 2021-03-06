/// <reference path="../../../typings/main.d.ts" />

import { IMinemeldConfigService, IMinemeldConfigInfo, IMinemeldConfigNode } from  '../../app/services/config';
import { IConfirmService } from '../../app/services/confirm';
import { IMinemeldSupervisorService } from '../../app/services/supervisor';

declare var he: any;

export class ConfigController {
    toastr: any;
    $scope: angular.IScope;
    $compile: angular.ICompileService;
    $state: angular.ui.IStateService;
    $q: angular.IQService;
    $modal: angular.ui.bootstrap.IModalService;
    DTColumnBuilder: any;
    DTOptionsBuilder: any;
    MinemeldConfigService: IMinemeldConfigService;
    MinemeldSupervisorService: IMinemeldSupervisorService;
    ConfirmService: IConfirmService;

    dtNodes: any = {};
    dtColumns: any[];
    dtOptions: any;

    changed: boolean = false;
    inCommit: boolean = false;

    configInfo: IMinemeldConfigInfo;
    nodesConfig: IMinemeldConfigNode[];

    /** @ngInject */
    constructor(toastr: any, $scope: angular.IScope, DTOptionsBuilder: any,
                DTColumnBuilder: any, $compile: angular.ICompileService,
                MinemeldConfigService: IMinemeldConfigService,
                MinemeldSupervisorService: IMinemeldSupervisorService,
                $state: angular.ui.IStateService, $q: angular.IQService,
                $modal: angular.ui.bootstrap.IModalService,
                ConfirmService: IConfirmService) {
        this.toastr = toastr;
        this.$scope = $scope;
        this.DTColumnBuilder = DTColumnBuilder;
        this.DTOptionsBuilder = DTOptionsBuilder;
        this.$compile = $compile;
        this.$state = $state;
        this.$q = $q;
        this.$modal = $modal;
        this.MinemeldConfigService = MinemeldConfigService;
        this.MinemeldSupervisorService = MinemeldSupervisorService;
        this.ConfirmService = ConfirmService;

        this.setupNodesTable();
    }

    revert() {
        this.MinemeldConfigService.reload('running').then((result: any) => {
            this.$state.go(this.$state.current.name, {}, {reload: true});
        }, (error: any) => {
            this.toastr.error('ERROR RELOADING CONFIG: ' + error.statusText);
        });
    }

    load() {
        this.MinemeldConfigService.reload('committed').then((result: any) => {
            this.$state.go(this.$state.current.name, {}, {reload: true});
        }, (error: any) => {
            this.toastr.error('ERROR RELOADING CONFIG: ' + error.statusText);
        });
    }

    configureOutput(nodenum: number) {
        var mi: angular.ui.bootstrap.IModalServiceInstance;

        mi = this.$modal.open({
            templateUrl: 'app/config/configureoutput.modal.html',
            controller: ConfigureOutputController,
            controllerAs: 'vm',
            bindToController: true,
            resolve: {
                nodenum: () => { return nodenum; }
            },
            backdrop: 'static',
            animation: false
        });

        mi.result.then((result: any) => {
            if (result !== 'ok') {
                this.toastr.error('ERROR SAVING NODE CONFIG: ' + result.statusText);
                this.refreshConfig().finally(() => {
                    this.changed = this.MinemeldConfigService.changed;
                    this.dtNodes.reloadData();
                });
            } else {
                this.changed = this.MinemeldConfigService.changed;
                this.dtNodes.reloadData();
            }
        });
    }

    configureInputs(nodenum: number) {
        var mi: angular.ui.bootstrap.IModalServiceInstance;

        mi = this.$modal.open({
            templateUrl: 'app/config/configureinputs.modal.html',
            controller: ConfigureInputsController,
            controllerAs: 'vm',
            bindToController: true,
            resolve: {
                nodenum: () => { return nodenum; }
            },
            backdrop: 'static',
            animation: false
        });

        mi.result.then((result: any) => {
            if (result !== 'ok') {
                this.toastr.error('ERROR SAVING NODE CONFIG: ' + result.statusText);
                this.refreshConfig().finally(() => {
                    this.dtNodes.reloadData();
                });
            } else {
                this.dtNodes.reloadData();
            }
        });
    }

    removeNode(nodenum: number) {
        var p: angular.IPromise<any>;

        p = this.ConfirmService.show(
            'DELETE NODE',
            'Are you sure you want to delete node ' + this.nodesConfig[nodenum].name + ' ?'
        );

        p.then((result: any) => {
            this.MinemeldConfigService.deleteNode(nodenum).then((result: any) => {
                this.dtNodes.reloadData();
            }, (error: any) => {
                this.toastr.error('ERROR DELETING NODE: ' + error.statusText);
                this.dtNodes.reloadData();
            });
        });
    }

    commit() {
        var p: angular.IPromise<any>;

        this.inCommit = true;
        p = this.MinemeldConfigService.commit().then((result: any) => {
            this.toastr.success('COMMIT SUCCESSFUL');
            this.dtNodes.reloadData();
            this.MinemeldSupervisorService.restartEngine().then(
                (result: any) => { this.toastr.success('Restarting engine, could take some minutes. Check <a href="/#/system">SYSTEM</a>'); },
                (error: any) => { this.toastr.error('ERROR RESTARTING ENGINE: ' + error.statusText); }
            );
        }, (error: any) => {
            if (error.status === 402) {
                this.toastr.error('COMMIT FAILED: ' + error.data.error.message.join(', '), '', { timeOut: 60000 });
            } else {
                this.toastr.error('ERROR IN COMMIT: ' + error.statusText);
            }
            this.dtNodes.reloadData();
        })
        .finally(() => { this.inCommit = false; });
    }

    private setupNodesTable() {
        var vm: ConfigController = this;

        this.dtOptions = this.DTOptionsBuilder.fromFnPromise(function() {
            return vm.getConfig();
        })
        .withBootstrap()
        .withPaginationType('simple_numbers')
        .withOption('order', [[2, 'asc'], [1, 'asc']])
        .withOption('aaSorting', [])
        .withOption('aaSortingFixed', [])
        .withOption('paging', false)
        .withOption('stateSave', true)
        .withOption('createdRow', function(row: HTMLScriptElement, data: any, index: any) {
            var c: string;
            var fc: HTMLElement;

            if (data.deleted === true) {
                row.style.display = 'none';
                return;
            }

            row.className += ' config-table-row';

            if ((!data.properties.inputs) || (data.properties.inputs.length === 0)) {
                c = 'nodes-dt-header-miner';
            } else if (data.properties.output === false) {
                    c = 'nodes-dt-header-output';
            } else {
                    c = 'nodes-dt-header-processor';
            }

            fc = <HTMLElement>(row.childNodes[0]);
            fc.className += ' ' + c;

            fc = <HTMLElement>(row.childNodes[4]);
            fc.setAttribute('ng-click', 'vm.configureInputs(' + index + ')');
            fc.className += ' config-table-clickable';

            fc = <HTMLElement>(row.childNodes[5]);
            fc.setAttribute('ng-click', 'vm.configureOutput(' + index + ')');
            fc.className += ' config-table-clickable';

            fc = <HTMLElement>(row.childNodes[6]);
            fc.setAttribute('ng-click', 'vm.removeNode(' + index + ')');
            fc.style.textAlign = 'center';
            fc.style.verticalAlign = 'middle';
            fc.setAttribute('tooltip', 'delete node');
            fc.setAttribute('tooltip-popup-delay', '500');
            fc.className += ' config-table-clickable';

            vm.$compile(angular.element(row).contents())(vm.$scope);
        })
        .withLanguage({
            'oPaginate': {
                'sNext': '>',
                'sPrevious': '<'
            }
        })
        ;

        this.dtColumns = [
            this.DTColumnBuilder.newColumn(null).withTitle('').renderWith(function(data: any, type: any, full: any) {
                return '';
            }).withOption('width', '5px').notSortable(),
            this.DTColumnBuilder.newColumn('name').withTitle('NAME').renderWith(function(data: any, type: any, full: any) {
                return he.encode(data, { strict: true });
            }),
            this.DTColumnBuilder.newColumn(null).withTitle('POSITION').renderWith(function(data: any, type: any, full: any) {
                var c: string;
                var v: string;

                if ((!full.properties.inputs) || (full.properties.inputs.length === 0)) {
                    c = 'nodes-label-miner';
                    v = 'MINER';
                } else if (full.properties.output === false) {
                    c = 'nodes-label-output';
                    v = 'OUTPUT';
                } else {
                    c = 'nodes-label-processor';
                    v = 'PROCESSOR';
                }

                return '<span class="label ' + c + '">' + v + '</span>';
            }),
            this.DTColumnBuilder.newColumn(null).withTitle('PROTOTYPE').renderWith(function(data: any, type: any, full: any) {
                if (full.properties.prototype) {
                    return full.properties.prototype;
                }

                return '<span class="config-none">None</span>';
            }),
            this.DTColumnBuilder.newColumn(null).withTitle('INPUTS').renderWith(function(data: any, type: any, full: any) {
                if (full.properties.inputs && (full.properties.inputs.length > 0)) {
                    var result: string[] = new Array();

                    result = ['<ul style="margin: 0;">'];
                    result = result.concat(full.properties.inputs.map(
                        (x: string) => { return '<li style="padding-bottom: 0px;">' + he.encode(x, {strict: true}) + '</li>'; }
                    ));
                    result.push('</ul>');

                    return result.join('');
                }

                return '<span class="config-none">None</span>';
            }),
            this.DTColumnBuilder.newColumn(null).withTitle('OUTPUT').renderWith(function(data: any, type: any, full: any) {
                var v: boolean = true;
                var c: string;
                var m: string;

                if (full.properties.output === false) {
                    v = full.properties.output;
                }

                c = 'label-default';
                m = 'DISABLED';
                if (v) {
                    c = 'label-success';
                    m = 'ENABLED';
                }

                return '<span class="label ' + c + '">' + m + '</span>';
            }),
            this.DTColumnBuilder.newColumn(null).withTitle('').notSortable().renderWith(function(data: any, type: any, full: any) {
                return '<span class="config-table-icon glyphicon glyphicon-remove"></span>';
            }).withOption('width', '30px')
        ];
    }

    private getConfig(): angular.IPromise<any> {
/*        if (this.MinemeldConfig.configInfo) {
            var $p: angular.IDeferred<any> = this.$q.defer();

            this.configInfo = this.MinemeldConfig.configInfo;
            this.nodesConfig = this.MinemeldConfig.nodesConfig;

            $p.resolve(this.MinemeldConfig.nodesConfig);

            return $p.promise;
        }*/

        return this.refreshConfig();
    }

    private refreshConfig(): angular.IPromise<any> {
        return this.MinemeldConfigService.refresh().then((result: any) => {
            this.configInfo = this.MinemeldConfigService.configInfo;
            this.nodesConfig = this.MinemeldConfigService.nodesConfig;
            this.changed = this.MinemeldConfigService.configInfo.changed;

            return result;
        }, (error: any) => {
            this.toastr.error('ERROR RELOADING CONFIG: ' + error.statusText);

            this.configInfo = undefined;
            this.nodesConfig = [];
            this.changed = false;

            return this.nodesConfig;
        });
    }
}

export class ConfigureOutputController {
    nodenum: number;
    MinemeldConfigService: IMinemeldConfigService;
    $modalInstance: angular.ui.bootstrap.IModalServiceInstance;

    nodeConfig: IMinemeldConfigNode;
    output: boolean;
    originalOutput: boolean;

    /** @ngInject */
    constructor(MinemeldConfigService: IMinemeldConfigService,
                $modalInstance: angular.ui.bootstrap.IModalServiceInstance,
                nodenum: number) {
        this.nodenum = nodenum;
        this.MinemeldConfigService = MinemeldConfigService;
        this.$modalInstance = $modalInstance;
        this.nodeConfig = this.MinemeldConfigService.nodesConfig[nodenum];
        this.output = this.nodeConfig.properties.output;
        this.originalOutput = this.output;
    }

    disableOutput() {
        this.output = false;
    }

    enableOutput() {
        this.output = true;
    }

    save() {
        this.nodeConfig.properties.output = this.output;
        this.MinemeldConfigService.saveNodeConfig(this.nodenum)
            .then((result: any) => {
                this.$modalInstance.close('ok');
            }, (error: any) => {
                this.$modalInstance.close(error);
            });
    }

    cancel() {
        this.$modalInstance.dismiss();
    }
}

export class ConfigureInputsController {
    nodenum: number;
    MinemeldConfigService: IMinemeldConfigService;
    $modalInstance: angular.ui.bootstrap.IModalServiceInstance;

    nodeConfig: IMinemeldConfigNode;
    inputs: string[];
    availableInputs: string[];
    changed: boolean = false;

    /** @ngInject */
    constructor(MinemeldConfigService: IMinemeldConfigService,
                $modalInstance: angular.ui.bootstrap.IModalServiceInstance,
                nodenum: number) {
        this.nodenum = nodenum;
        this.MinemeldConfigService = MinemeldConfigService;
        this.$modalInstance = $modalInstance;
        this.nodeConfig = this.MinemeldConfigService.nodesConfig[nodenum];
        this.inputs = angular.copy(this.nodeConfig.properties.inputs);
        this.availableInputs = this.MinemeldConfigService.nodesConfig
            .filter((x: IMinemeldConfigNode) => {
                if (x.deleted) {
                    return false;
                }

                return true;
            })
            .map((x: IMinemeldConfigNode) => { return x.name; });
    }

    hasChanged() {
        this.changed = true;
    }

    save() {
        this.nodeConfig.properties.inputs = this.inputs;
        this.MinemeldConfigService.saveNodeConfig(this.nodenum)
            .then((result: any) => {
                this.$modalInstance.close('ok');
            }, (error: any) => {
                this.$modalInstance.close(error);
            });
    }

    cancel() {
        this.$modalInstance.dismiss();
    }
}
