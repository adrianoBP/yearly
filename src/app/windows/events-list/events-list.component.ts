import { Component, Input } from '@angular/core';
import { WindowParameters } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import moment from 'moment';
import { Event, EventExtended } from '../../interfaces/event.interface';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './events-list.component.html',
  styleUrl: './events-list.component.css',
})
export class EventsListComponent {
  @Input() parameters: WindowParameters = {
    eventsList: [],
    date: new Date(),
  };

  ngOnInit(): void {
    console.log(this.parameters.eventsList);
  }

  getFormattedDate(): string {
    return moment(this.parameters.date).format('ddd, Do MMMM YYYY'); // Format: 'Mon, 1 January 2021'
  }

  getTime(event: EventExtended): string {
    if (event.allDay) return 'All day';

    const start = moment(event.start);
    const end = moment(event.end);
    return `${start.format('HH:mm')} - ${end.format('HH:mm')}`;
  }
}
