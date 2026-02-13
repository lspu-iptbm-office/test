class SMSQueueManager {
  constructor() {
    this.userQueues = new Map();
    this.activeDelays = new Map();
  }

  async queueOrProcess(apiKey, smsData, processFn) {
    if (!this.userQueues.has(apiKey)) {
      this.userQueues.set(apiKey, []);
    }

    const queue = this.userQueues.get(apiKey);
    
    return new Promise((resolve, reject) => {
      queue.push({
        smsData,
        resolve,
        reject,
        timestamp: new Date()
      });

      this.processQueue(apiKey, processFn);
    });
  }

  async processQueue(apiKey, processFn) {
    if (this.activeDelays.get(apiKey)) {
      return;
    }

    const queue = this.userQueues.get(apiKey);
    if (!queue || queue.length === 0) {
      return;
    }

    const nextSMS = queue.shift();
    
    try {
      const result = await processFn(nextSMS.smsData);
      nextSMS.resolve(result);
      
      this.activeDelays.set(apiKey, setTimeout(() => {
        this.activeDelays.delete(apiKey);
        this.processQueue(apiKey, processFn);
      }, 2000));
      
    } catch (error) {
      nextSMS.reject(error);
      this.activeDelays.delete(apiKey);
      this.processQueue(apiKey, processFn);
    }
  }

  getQueueStats(apiKey) {
    const queue = this.userQueues.get(apiKey) || [];
    return {
      queued_messages: queue.length,
      next_available_in: this.activeDelays.get(apiKey) ? 2 : 0
    };
  }

  clearQueue(apiKey) {
    this.userQueues.delete(apiKey);
    if (this.activeDelays.has(apiKey)) {
      clearTimeout(this.activeDelays.get(apiKey));
      this.activeDelays.delete(apiKey);
    }
  }
}

module.exports = new SMSQueueManager();