import { Component, Input } from '@angular/core';
import { WindowParameters, WindowsService } from '../windows.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import moment from 'moment';
import { Event } from '../../interfaces/event.interface';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './events-list.component.html',
  styleUrl: './events-list.component.css',
})
export class EventsListComponent {
  @Input() parameters: WindowParameters = {
    eventsList: [],
    date: new Date(),
  };

  constructor(private windowsService: WindowsService) {}

  // FontAwesome icons
  faTrash = faTrash;

  // Properties
  eventsToDelete: Event[] = [];

  ngOnInit(): void {
    console.log(this.parameters.eventsList);
  }

  getFormattedDate(): string {
    return moment(this.parameters.date).format('ddd, Do MMMM YYYY'); // Format: 'Mon, 1 January 2021'
  }

  getTime(event: Event): string {
    if (event.allDay) return 'All day';

    const start = moment(event.start);
    const end = moment(event.end);
    return `${start.format('HH:mm')} - ${end.format('HH:mm')}`;
  }

  removeEvent(event: Event): void {
    this.eventsToDelete.push(event);
    this.parameters.eventsList = this.parameters.eventsList!.filter((e) => e.id !== event.id);
  }

  saveChanges(): void {
    console.log(this.eventsToDelete);

    // TODO: delete events

    this.windowsService.closeWindow(this.eventsToDelete);

    // TODO: push changes to the calendar
  }
}
