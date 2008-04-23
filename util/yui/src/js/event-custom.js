YUI.add("event-custom", function(Y) {

    Y.EventHandle = function(evt, sub) {
        if (!evt || !sub) {
            return null;
        }
        this.evt = evt;
        this.sub = sub;
    };

    Y.EventHandle.prototype = {
        detach: function() {
            this.evt._delete(this.sub);
        }
    };

    /**
     * The Event.Custom class lets you define events for your application
     * that can be subscribed to by one or more independent component.
     *
     * @param {String}  type The type of event, which is passed to the callback
     *                  when the event fires
     * @param {Object}  context The context the event will fire from.  "this" will
     *                  refer to this object in the callback.  Default value: 
     *                  the window object.  The listener can override this.
     * @param {boolean} silent pass true to prevent the event from writing to
     *                  the debugsystem
     * @param {int}     signature the signature that the custom event subscriber
     *                  will receive. Y.Event.Custom.LIST or 
     *                  Y.Event.Custom.FLAT.  The default is
     *                  Y.Event.Custom.FLAT.
     * @namespace Y
     * @class Event.Custom
     * @constructor
     */
    Y.CustomEvent = function(type, context, silent, signature) {

        /**
         * The type of event, returned to subscribers when the event fires
         * @property type
         * @type string
         */
        this.type = type;

        /**
         * The context the the event will fire from by default.  Defaults to the YUI
         * instance.
         * @property context
         * @type object
         */
        this.context = context || Y;

        /**
         * By default all custom events are logged in the debug build, set silent
         * to true to disable debug outpu for this event.
         * @property silent
         * @type boolean
         */
        this.silent = silent || (type == "yui:log");

        /**
         * Custom events support two styles of arguments provided to the event
         * subscribers.  
         * <ul>
         * <li>Y.Event.Custom.LIST: 
         *   <ul>
         *   <li>param1: event name</li>
         *   <li>param2: array of arguments sent to fire</li>
         *   <li>param3: <optional> a custom object supplied by the subscriber</li>
         *   </ul>
         * </li>
         * <li>Y.Event.Custom.FLAT
         *   <ul>
         *   <li>param1: the first argument passed to fire.  If you need to
         *           pass multiple parameters, use and array or object literal</li>
         *   <li>param2: <optional> a custom object supplied by the subscriber</li>
         *   </ul>
         * </li>
         * </ul>
         *   @property signature
         *   @type int
         */
        this.signature = signature || Y.CustomEvent.FLAT;

        /**
         * The subscribers to this event
         * @property subscribers
         * @type Event.Subscriber{}
         */
        this.subscribers = {};

        this.log("Creating " + this);

        var onsubscribeType = "_YUICEOnSubscribe";

        // Only add subscribe events for events that are not generated by 
        // Event.Custom
        if (type !== onsubscribeType) {

            /**
             * Custom events provide a custom event that fires whenever there is
             * a new subscriber to the event.  This provides an opportunity to
             * handle the case where there is a non-repeating event that has
             * already fired has a new subscriber.  
             *
             * @event subscribeEvent
             * @type Y.Event.Custom
             * @param {Function} fn The function to execute
             * @param {Object}   obj An object to be passed along when the event 
             *                       fires
             * @param {boolean|Object}  override If true, the obj passed in becomes 
             *                                   the execution context of the listener.
             *                                   if an object, that object becomes the
             *                                   the execution context.
             */
            this.subscribeEvent = 
                    new Y.CustomEvent(onsubscribeType, this, true);

            /**
             * This event has fired if true
             *
             * @property fired
             * @type boolean
             * @default false;
             */
            this.fired = false;

            /**
             * This event should only fire one time if true, and if
             * it has fired, any new subscribers should be notified
             * immediately.
             *
             * @property fireOnce
             * @type boolean
             * @default false;
             */
            this.fireOnce = false;
        } 


        /**
         * In order to make it possible to execute the rest of the subscriber
         * stack when one thows an exception, the subscribers exceptions are
         * caught.  The most recent exception is stored in this property
         * @property lastError
         * @type Error
         */
        this.lastError = null;
    };

    /**
     * Event.Subscriber listener sigature constant.  The LIST type returns three
     * parameters: the event type, the array of args passed to fire, and
     * the optional custom object
     * @property Y.Event.Custom.LIST
     * @static
     * @type int
     */
    Y.CustomEvent.LIST = 0;

    /**
     * Event.Subscriber listener sigature constant.  The FLAT type returns two
     * parameters: the first argument passed to fire and the optional 
     * custom object
     * @property Y.Event.Custom.FLAT
     * @static
     * @type int
     */
    Y.CustomEvent.FLAT = 1;

    Y.CustomEvent.prototype = {

        /**
         * Subscribes the caller to this event
         * @method subscribe
         * @param {Function} fn        The function to execute
         * @param {Object}   obj       An object to be passed along when the event 
         *                             fires
         * @param {boolean|Object}  override If true, the obj passed in becomes 
         *                                   the execution context of the listener.
         *                                   if an object, that object becomes the
         *                                   the execution context.
         * @return unsubscribe handle
         */
        subscribe: function(fn, obj) {

            if (!fn) {
throw new Error("Invalid callback for CE: '" + this.type + "'");
            }

            var se = this.subscribeEvent;
            if (se) {
                se.fire.apply(se, arguments);
            }

            // bind context and extra params
            var m = (obj) ? Y.bind.apply(obj, arguments) : fn;

            var s = new Y.Subscriber(m);
            s.ofn = fn;

            if (this.fireOnce && this.fired) {
                this.lastError = null;
                this._notify(s);
                if (this.lastError) {
                    throw this.lastError;
                }
            }

            this.subscribers[s.id] = s;

            return new Y.EventHandle(this, s);

        },

        /**
         * Unsubscribes subscribers.
         * @method unsubscribe
         * @param {Function} fn  The subscribed function to remove, if not supplied
         *                       all will be removed
         * @param {Object}   obj  The custom object passed to subscribe.  This is
         *                        optional, but if supplied will be used to
         *                        disambiguate multiple listeners that are the same
         *                        (e.g., you subscribe many object using a function
         *                        that lives on the prototype)
         * @return {boolean} True if the subscriber was found and detached.
         */
        unsubscribe: function(fn, obj) {

            // if arg[0] typeof unsubscribe handle
            if (fn && fn.detach) {
                return fn.detach();
            }

            if (!fn) {
                return this.unsubscribeAll();
            }

            var found = false;
            for (var i in this.subscribers) {
                var s = this.subscribers[i];
                if (s && s.contains(fn, obj)) {
                    this._delete(s);
                    found = true;
                }
            }

            return found;
        },

        _notify: function(s, args) {

            this.log(this.type + "->" + ": " +  s);

            var context = s.getScope(this.context), ret;

            if (this.signature == Y.CustomEvent.FLAT) {

                //try {
                    ret = s.fn.apply(context, args);
                // } catch(e) {
                //    this.lastError = e;
//this.log(this + " subscriber exception: " + e, "error");
 //               }

            } else {
                try {
                    ret = s.fn.call(context, this.type, args, s.obj);
                } catch(ex) {
                    this.lastError = ex;
this.log(this + " subscriber exception: " + ex, "error");
                }
            }
            if (false === ret) {
                this.log("Event cancelled by subscriber");

                //break;
                return false;
            }

            return true;
        },

        log: function(msg, cat) {
            if (!this.silent) {
                Y.log(msg, cat || "info", "Event");
            }
        },

        /**
         * Notifies the subscribers.  The callback functions will be executed
         * from the context specified when the event was created, and with the 
         * following parameters:
         *   <ul>
         *   <li>The type of event</li>
         *   <li>All of the arguments fire() was executed with as an array</li>
         *   <li>The custom object (if any) that was passed into the subscribe() 
         *       method</li>
         *   </ul>
         * @method fire 
         * @param {Object*} arguments an arbitrary set of parameters to pass to 
         *                            the handler.
         * @return {boolean} false if one of the subscribers returned false, 
         *                   true otherwise
         */
        fire: function() {
            // var subs = this.subscribers.slice(), len=subs.length,
            var subs = Y.merge(this.subscribers),
                args=Y.array(arguments, 0, true), ret=true, i, rebuild=false;

            this.log("Firing "       + this  + ", " + 
                     "args: "        + args);
                     // + "subscribers: " + len);

            // if (!len) {
                // return true;
            // }

            var errors = [];

            // for (i=0; i<len; ++i) {
            for (i in subs) {
                var s = subs[i];
                if (!s || !s.fn) {
                    rebuild=true;
                } else {
                    this.lastError = null;
                    ret = this._notify(s, args);
                    if (this.lastError) {
                        errors.push(this.lastError);
                    }
                    if (!ret) {
                        break;
                    }
                }
            }

            this.fired = true;

            if (errors.length) {
throw new Y.ChainedError(this.type + ': 1 or more subscribers threw an error: ' +
                         errors[0].message, errors);
            }

            return ret;
        },

        /**
         * Removes all listeners
         * @method unsubscribeAll
         * @return {int} The number of listeners unsubscribed
         */
        unsubscribeAll: function() {
            // for (var i=0, len=this.subscribers.length; i<len; ++i) {
            for (var i in this.subscribers) {
                this._delete(this.subscribers[i]);
            }

            this.subscribers={};

            return i;
        },

        /**
         * @method _delete
         * @param subscriber object
         * @private
         */
        _delete: function(s) {

            if (s) {
                delete s.fn;
                delete s.obj;
                delete s.ofn;
                delete this.subscribers[s.id];
            }

        },

        /**
         * @method toString
         */
        toString: function() {
             return "'" + this.type + "'";
                  // + "context: " + this.context;

        }
    };

    /////////////////////////////////////////////////////////////////////

    /**
     * Stores the subscriber information to be used when the event fires.
     * @param {Function} fn       The function to execute
     * @param {Object}   obj      An object to be passed along when the event fires
     * @param {boolean}  override If true, the obj passed in becomes the execution
     *                            context of the listener
     * @class Event.Subscriber
     * @constructor
     */
    Y.Subscriber = function(fn, obj, override) {

        /**
         * The callback that will be execute when the event fires
         * This is wrappedif obj was supplied.
         * @property fn
         * @type function
         */
        this.fn = fn;

        /**
         * An optional custom object that will passed to the callback when
         * the event fires
         * @property obj
         * @type object
         */
        this.obj = Y.lang.isUndefined(obj) ? null : obj;

        /**
         * The default execution context for the event listener is defined when the
         * event is created (usually the object which contains the event).
         * By setting override to true, the execution context becomes the custom
         * object passed in by the subscriber.  If override is an object, that 
         * object becomes the context.
         * @property override
         * @type boolean|object
         */
        this.override = override;

        this.id = Y.stamp(this);

        /**
         * Original function
         */
        this.ofn = null;

    };

    /**
     * Returns the execution context for this listener.  If override was set to true
     * the custom obj will be the context.  If override is an object, that is the
     * context, otherwise the default context will be used.
     * @method getScope
     * @param {Object} defaultScope the context to use if this listener does not
     *                              override it.
     */
    Y.Subscriber.prototype.getScope = function(defaultScope) {
        if (this.override) {
            if (this.override === true) {
                return this.obj;
            } else {
                return this.override;
            }
        }
        return defaultScope;
    };

    /**
     * Returns true if the fn and obj match this objects properties.
     * Used by the unsubscribe method to match the right subscriber.
     *
     * @method contains
     * @param {Function} fn the function to execute
     * @param {Object} obj an object to be passed along when the event fires
     * @return {boolean} true if the supplied arguments match this 
     *                   subscriber's signature.
     */
    Y.Subscriber.prototype.contains = function(fn, obj) {
        if (obj) {
            return ((this.fn == fn || this.ofn == fn) && this.obj == obj);
        } else {
            return (this.fn == fn || this.ofn == fn);
        }
    };

    /**
     * @method toString
     */
    Y.Subscriber.prototype.toString = function() {
return "Sub { obj: " + this.obj  + ", override: " + (this.override || "no") + " }";
    };

/**
 * ChainedErrors wrap one or more exceptions thrown by a subprocess.
 *
 * @namespace YAHOO.util
 * @class ChainedError
 * @extends Error
 * @constructor
 * @param message {String} The message to display when the error occurs.
 * @param errors {Error[]} an array containing the wrapped exceptions
 */ 
Y.ChainedError = function (message, errors){

    arguments.callee.superclass.constructor.call(this, message);
    
    /*
     * Error message. Must be duplicated to ensure browser receives it.
     * @type String
     * @property message
     */
    this.message = message;
    
    /**
     * The name of the error that occurred.
     * @type String
     * @property name
     */
    this.name = "ChainedError";

    /**
     * The list of wrapped exception objects
     * @type Error[]
     * @property errors
     */
    this.errors = errors || [];

    /**
     * Pointer to the current exception
     * @type int
     * @property index
     * @default 0
     */
    this.index = 0;
};

Y.extend(Y.ChainedError, Error, {

    /**
     * Returns a fully formatted error message.
     * @method getMessage
     * @return {String} A string describing the error.
     */
    getMessage: function () {
        return this.message;
    },
    
    /**
     * Returns a string representation of the error.
     * @method toString
     * @return {String} A string representation of the error.
     */
    toString: function () {
        return this.name + ": " + this.getMessage();
    },
    
    /**
     * Returns a primitive value version of the error. Same as toString().
     * @method valueOf
     * @return {String} A primitive value version of the error.
     */
    valueOf: function () {
        return this.toString();
    },

    /**
     * Returns the next exception object this instance wraps
     * @method next
     * @return {Error} the error that was thrown by the subsystem.
     */
    next: function() {
        var e = this.errors[this.index] || null;
        this.index++;
        return e;
    },

    /**
     * Append an error object
     * @method add
     * @param e {Error} the error object to append
     */
    add: function(e) {
        this.errors.push(e);
    }

});

}, "3.0.0");
