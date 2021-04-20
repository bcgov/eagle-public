import { Component, OnDestroy, OnInit } from '@angular/core';
import { ConfigService } from 'app/services/config.service';

import { TableRowComponent } from 'app/shared/components/table-template-2/table-row-component';
import { Utils } from 'app/shared/utils/utils';
import { takeWhile } from 'rxjs/operators';

@Component({
    selector: 'tr[app-project-notification-documents-table-rows]',
    templateUrl: './project-notification-documents-table-rows.component.html',
    styleUrls: ['./project-notification-documents-table-rows.component.scss']
})

export class ProjectNotificationDocumentsTableRowsComponent extends TableRowComponent implements OnInit, OnDestroy {
    private lists: any[] = [];
    private alive = true;
    constructor(
        private configService: ConfigService,
        private utils: Utils
    ) {
        super();
    }
    ngOnInit() {
        this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
            this.lists = list;
        });
    }

    idToList(id: string) {
        if (!id) {
            return '-';
        }
        // Grab the item from the constant lists, returning the name field of the object.
        const items = this.lists.filter(listItem => listItem._id === id);
        if (items.length !== 0) {
            return items[0].name;
        } else {
            return '-';
        }
    }

    goToItem(item) {
        const filename = item.documentFileName || item.displayName || item.internalOriginalName;
        let safeName = filename;
        try {
            safeName = this.utils.encodeString(filename, true)
        } catch (e) {
            console.log('error:', e);
        }
        window.open('/api/public/document/' + item._id + '/download/' + safeName, '_blank');
    }

    ngOnDestroy() {
        this.alive = false;
    }
}
